import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://adii.fyi",
  redirects: {
    '/resume': '/adityamotale.pdf',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
