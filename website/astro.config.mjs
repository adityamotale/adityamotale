import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://adii.fyi",
  redirects: {
    '/resume': '/aditya.pdf',
    '/blogs': '/blog',
    '/blogs/[slug]': '/blog/[slug]',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
