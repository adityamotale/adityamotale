import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  redirects: {
    '/resume': '/adityamotale.pdf',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
