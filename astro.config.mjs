// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";
import pressKitZip from "./integrations/press-kit-zip.mjs";

// https://astro.build/config
export default defineConfig({
	site: "https://coldfrontgames.ca",
	integrations: [mdx(), sitemap(), pressKitZip()],
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
});
