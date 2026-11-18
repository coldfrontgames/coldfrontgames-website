// Receives the Steam key request form from /dwarfspire/press-kit and emails it
// to the studio through Cloudflare Email Routing (the KEY_REQUEST_EMAIL
// send_email binding in wrangler.json).
//
// Setup: enable Email Routing on coldfrontgames.ca, verify the destination
// address, and set KEY_REQUEST_TO (and optionally KEY_REQUEST_FROM) in
// wrangler.json "vars".
import type { APIRoute } from 'astro';

export const prerender = false;

const REASONS = ['press', 'creator', 'curator', 'event', 'other'] as const;
const REASON_LABELS: Record<(typeof REASONS)[number], string> = {
	press: 'Press / review coverage',
	creator: 'Video or stream content',
	curator: 'Steam curator',
	event: 'Festival or event',
	other: 'Other',
};

const LIMITS = { name: 100, email: 254, company: 150, website: 300, comments: 3000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = keyof typeof LIMITS | 'firstName' | 'lastName' | 'reason';

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

// RFC 2047 encoded-word, so non-ASCII names survive in the Subject header.
function encodeHeader(value: string) {
	return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${toBase64(value)}?=`;
}

function toBase64(value: string) {
	const bytes = new TextEncoder().encode(value);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

// Strips CR/LF so user input can never inject extra headers.
const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim();

export const POST: APIRoute = async ({ request, locals }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ ok: false, error: 'bad-request' }, 400);
	}

	const get = (k: string) => String(form.get(k) ?? '').trim();

	// Honeypot: real visitors never see or fill this field. Pretend success.
	if (get('fax')) return json({ ok: true });

	const data = {
		firstName: oneLine(get('firstName')),
		lastName: oneLine(get('lastName')),
		email: oneLine(get('email')),
		company: oneLine(get('company')),
		website: oneLine(get('website')),
		reason: get('reason'),
		comments: get('comments'),
	};

	const invalid: Field[] = [];
	if (!data.firstName || data.firstName.length > LIMITS.name) invalid.push('firstName');
	if (!data.lastName || data.lastName.length > LIMITS.name) invalid.push('lastName');
	if (!EMAIL_RE.test(data.email) || data.email.length > LIMITS.email) invalid.push('email');
	if (data.company.length > LIMITS.company) invalid.push('company');
	if (data.website) {
		let ok = data.website.length <= LIMITS.website;
		try {
			const u = new URL(/^https?:\/\//i.test(data.website) ? data.website : `https://${data.website}`);
			ok &&= u.hostname.includes('.');
		} catch {
			ok = false;
		}
		if (!ok) invalid.push('website');
	}
	if (!(REASONS as readonly string[]).includes(data.reason)) invalid.push('reason');
	if (data.comments.length > LIMITS.comments) invalid.push('comments');
	if (invalid.length) return json({ ok: false, error: 'invalid', fields: invalid }, 400);

	const env = locals.runtime.env;
	const to = env.KEY_REQUEST_TO;
	const from = env.KEY_REQUEST_FROM || 'noreply@coldfrontgames.ca';
	if (!to || !env.KEY_REQUEST_EMAIL) {
		console.error('key-request: KEY_REQUEST_TO or KEY_REQUEST_EMAIL binding is not configured');
		return json({ ok: false, error: 'unavailable' }, 503);
	}

	const fullName = `${data.firstName} ${data.lastName}`;
	const reasonLabel = REASON_LABELS[data.reason as (typeof REASONS)[number]];
	const body = [
		'New Dwarfspire Steam key request',
		'',
		`Name:     ${fullName}`,
		`Email:    ${data.email}`,
		`Company:  ${data.company || '—'}`,
		`Website:  ${data.website || '—'}`,
		`Reason:   ${reasonLabel}`,
		'',
		'Comments:',
		data.comments || '—',
		'',
		`Submitted ${new Date().toISOString()} from ${request.headers.get('cf-connecting-ip') ?? 'unknown IP'}`,
	].join('\r\n');

	const domain = from.split('@')[1];
	const raw = [
		`From: "Coldfront Key Requests" <${from}>`,
		`To: <${to}>`,
		`Reply-To: ${encodeHeader(`"${fullName.replace(/"/g, '')}"`)} <${data.email}>`,
		`Subject: ${encodeHeader(`Steam key request: ${fullName} (${reasonLabel})`)}`,
		`Message-ID: <${crypto.randomUUID()}@${domain}>`,
		`Date: ${new Date().toUTCString()}`,
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset=UTF-8',
		'Content-Transfer-Encoding: base64',
		'',
		toBase64(body).replace(/.{76}/g, '$&\r\n'),
	].join('\r\n');

	try {
		const { EmailMessage } = await import('cloudflare:email');
		await env.KEY_REQUEST_EMAIL.send(new EmailMessage(from, to, raw));
	} catch (err) {
		console.error('key-request: send failed', err);
		return json({ ok: false, error: 'send-failed' }, 502);
	}

	return json({ ok: true });
};
