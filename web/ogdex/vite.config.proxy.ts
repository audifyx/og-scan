import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// Dev-only override: same as vite.config.ts but proxies /api to the local
// ogdex API dev server (see /tmp/ogdex-api-server.mjs) so the screener,
// scanner and search show live data during local development.
export default defineConfig({
  base: "/ORBITX_DEX/",
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
