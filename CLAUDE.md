# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Astro-based marketing/studio website for Coldfront Games, deployed as a static site on Cloudflare Workers. The site is a single-page layout (`src/pages/index.astro`) with a hero, studio bio, and Dwarfspire game section. It was built from the Bear Blog template but has been extensively redesigned.

## Commands

```bash
npm run dev        # Local dev server at localhost:4321
npm run build      # Build to ./dist/
npm run preview    # Preview build locally (astro build + wrangler dev)
npm run check      # Validate: astro build && tsc && wrangler deploy --dry-run
npm run deploy     # Deploy to Cloudflare Workers via wrangler
npm run cf-typegen # Regenerate Cloudflare Worker types
```

> Node.js >= 22 required

## Architecture

**Main page:** All site content lives in `src/pages/index.astro`. This file contains the full HTML structure, all page-scoped CSS (in a `<style>` block), and all client-side JS (in a `<script>` block). Avoid splitting these into separate files unless there's a strong reason.

**Content pipeline:** Markdown/MDX files in `src/content/blog/` → validated by schema in `src/content.config.ts` (Zod) → rendered via `src/pages/blog/[...slug].astro` → wrapped by `src/layouts/BlogPost.astro`. Not actively used yet.

**Routing:** File-based via `src/pages/`. The blog listing at `/blog` sorts all posts by `pubDate` descending.

**Site-wide constants** (title, description) live in `src/consts.ts`.

**Deployment:** Astro builds static HTML/CSS/JS → Cloudflare adapter packages for Workers → Wrangler deploys. The `wrangler.json` config controls the Workers environment. `public/.assetsignore` controls which assets are excluded from deployment.

**Styling:** Page styles are scoped inside `src/pages/index.astro`. The global stylesheet at `src/styles/global.css` still exists but most of its rules are overridden by the page-level styles (especially `main`, body font, and layout). Fonts: Google Fonts (Barlow 700/900 + DM Sans) loaded via `<link>` in index.astro; Atkinson is self-hosted in `public/fonts/` but only used by the global CSS fallback.

**SEO:** `src/components/BaseHead.astro` handles all meta tags, OpenGraph, and Twitter card markup. The site URL in `astro.config.mjs` must be set correctly for sitemap and RSS feed generation.

## index.astro structure

### Color palette (CSS variables in `:root`)
`--white`, `--sky` (#6fc4ef), `--blue` (#1c80cb), `--mid-blue` (#367cc1), `--navy` (#033b8c), `--deep` (#133454). Semantic aliases: `--bg`, `--bg-alt`, `--ink`, `--ink-mid`, `--ink-faint`, `--ice`, `--border`.

### Sections
- **Header** — fixed, transparent at top (gradient blur), transitions to frosted white on scroll via `.scrolled` class. Contains logo, nav links, EN/FR language toggle, social icons (X, TikTok, Discord, YouTube, Instagram), and hamburger for mobile.
- **Hero** — full-viewport, dark blue background with UV diagonal parallax (`background-position` animated via `requestAnimationFrame`). Contains an animated logo (`.hero-logo-clip` / `.hero-logo`) and heading text.
- **Studio** (`#studio`) — two-column grid with label + body copy. Fully translated EN/FR.
- **Dwarfspire** (`#dwarfspire`) — 5-layer parallax section using `background-position` layers animated on scroll. Dark overlay via `::before`. Contains the Dwarfspire logo image.
- **Contact** (`#contact`) — hidden (`hidden` attribute), kept for future use.
- **Footer** — dark blue bar with studio name and tagline.
- **Mobile menu** — full-screen overlay triggered by hamburger, includes language toggle.

### EN/FR language toggle
All translatable text elements carry a `data-i18n="key"` attribute. The JS `translations` object maps each key to `{ en, fr }` strings. `applyLang(lang)` sets `textContent` on each element and persists the choice to `localStorage` under `'cf-lang'`. The hero heading is split into three separate `<span>` elements (`hero-line1`, `hero-line2`, `hero-sub`) so that the `.hero-sub` span (blue color) is always in the DOM and Astro's scoped CSS applies correctly. In French, `hero-line2` is set to empty and its wrapper (`.hero-line2-group`) is hidden.

### Parallax
- **Hero bg**: `requestAnimationFrame` loop animates `background-position` diagonally (UV scroll). Speed constants: `UV_SPEED_X = 18`, `UV_SPEED_Y = 10`, `SCROLL_FACTOR = 0.25`.
- **Dwarfspire layers**: scroll event listener sets `translateY` on each `.ds-layer` at different speeds (0.05 – 0.48). Layers are absolutely positioned with `inset: -60% 0 -30% 0` to avoid clipping during parallax travel. On narrow viewports, all layers shift left via `clamp(-150px, calc(37.5vw - 270px), 0px)` on background-position X.

## Public assets

```
public/
  background.png          # Hero parallax background (tileable)
  logo_anim.webm          # Animated logo for hero section (video, plays once)
  favicon.svg
  fonts/                  # Self-hosted Atkinson font (legacy)
  dwarfspire/
    logo.png              # Dwarfspire game logo
    background_0.png      # Parallax layer 0 (back)
    background_1.png
    background_2.png
    background_3.png
    background_4.png      # Parallax layer 4 (front)
```

## Adding Blog Posts

Create a `.md` or `.mdx` file in `src/content/blog/` with this frontmatter:

```yaml
---
title: 'Post Title'
description: 'Short description'
pubDate: 'Jan 01 2026'
heroImage: '/blog-placeholder-1.jpg'  # optional
---
```

The `heroImage` field is optional — omitting it is valid per the schema.
