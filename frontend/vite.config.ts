import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "http://10.12.4.10:5000", changeOrigin: true },
      "/api/ws": { target: "ws://10.12.4.10:5000", ws: true },
      "/uploads": { target: "http://10.12.4.10:5000", changeOrigin: true },
    },
  },
});
