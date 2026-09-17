import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://adii.fyi",
  integrations: [sitemap()],
  redirects: {
    '/resume': '/adityamotale.pdf',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
