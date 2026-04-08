# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Astro-based blog/portfolio website for Coldfront Games, deployed as a static site on Cloudflare Workers. Based on the Bear Blog theme.

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

**Content pipeline:** Markdown/MDX files in `src/content/blog/` → validated by schema in `src/content.config.ts` (Zod) → rendered via `src/pages/blog/[...slug].astro` → wrapped by `src/layouts/BlogPost.astro`.

**Routing:** File-based via `src/pages/`. The blog listing at `/blog` sorts all posts by `pubDate` descending. Individual posts are generated dynamically via `[...slug].astro`.

**Site-wide constants** (title, description, etc.) live in `src/consts.ts`. Update these when rebranding.

**Deployment:** Astro builds static HTML/CSS/JS → Cloudflare adapter packages for Workers → Wrangler deploys. The `wrangler.json` config controls the Workers environment, compatibility date, and observability settings. `public/.assetsignore` controls which assets are excluded from the Cloudflare deployment.

**Styling:** Single global stylesheet at `src/styles/global.css` using vanilla CSS with custom properties for the color scheme. The Atkinson font is self-hosted in `public/fonts/`.

**SEO:** `src/components/BaseHead.astro` handles all meta tags, OpenGraph, and Twitter card markup. The site URL in `astro.config.mjs` (currently `"https://example.com"`) must be set correctly for sitemap and RSS feed generation.

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
