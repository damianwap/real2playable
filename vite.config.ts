import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  preview: { proxy: { "/api": "http://127.0.0.1:8000" } },
  build: {
    rollupOptions: {
      input: {
        studio: fileURLToPath(new URL("./index.html", import.meta.url)),
        playground: fileURLToPath(
          new URL("./playground/index.html", import.meta.url),
        ),
      },
    },
  },
});
