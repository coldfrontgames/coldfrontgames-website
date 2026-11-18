// Bundles every image in public/dwarfspire/Screenshots into a single ZIP
// (public/dwarfspire/Dwarfspire-Press-Images.zip) so the press kit can offer
// a one-click "download all". Runs on dev and build, before pages render.
//
// Images are already compressed, so entries are STORED (no deflate): the
// writer stays dependency-free and the archive is barely larger than the sum
// of its files.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const SCREENSHOT_DIR = 'public/dwarfspire/Screenshots';
export const ZIP_PATH = 'public/dwarfspire/Dwarfspire-Press-Images.zip';
const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i;

function dosDateTime(date) {
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
	const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	return { time, day };
}

function buildZip(files) {
	const locals = [];
	const centrals = [];
	let offset = 0;

	for (const { name, data, mtime } of files) {
		const nameBuf = Buffer.from(name, 'utf8');
		const crc = zlib.crc32(data);
		const { time, day } = dosDateTime(mtime);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);          // version needed
		local.writeUInt16LE(0x0800, 6);      // flags: UTF-8 names
		local.writeUInt16LE(0, 8);           // method: stored
		local.writeUInt16LE(time, 10);
		local.writeUInt16LE(day, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(nameBuf.length, 26);
		local.writeUInt16LE(0, 28);
		locals.push(local, nameBuf, data);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);        // version made by
		central.writeUInt16LE(20, 6);        // version needed
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt16LE(0, 10);
		central.writeUInt16LE(time, 12);
		central.writeUInt16LE(day, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBuf.length, 28);
		central.writeUInt32LE(offset, 42);   // local header offset
		centrals.push(central, nameBuf);

		offset += 30 + nameBuf.length + data.length;
	}

	const centralSize = centrals.reduce((n, b) => n + b.length, 0);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(centralSize, 12);
	end.writeUInt32LE(offset, 16);

	return Buffer.concat([...locals, ...centrals, end]);
}

export function writePressKitZip(root = process.cwd()) {
	const dir = path.join(root, SCREENSHOT_DIR);
	const files = fs
		.readdirSync(dir)
		.filter((f) => IMAGE_RE.test(f))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
		.map((f) => {
			const full = path.join(dir, f);
			return { name: f, data: fs.readFileSync(full), mtime: fs.statSync(full).mtime };
		});
	fs.writeFileSync(path.join(root, ZIP_PATH), buildZip(files));
}

export default function pressKitZip() {
	return {
		name: 'press-kit-zip',
		hooks: {
			'astro:config:setup': ({ config, logger }) => {
				writePressKitZip(fileURLToPath(config.root));
				logger.info(`wrote ${ZIP_PATH}`);
			},
		},
	};
}
