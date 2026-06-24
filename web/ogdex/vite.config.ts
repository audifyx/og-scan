import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// OGDEX is mounted as a sub-app of OG Scan at ogscan.fun/OGDEX.
// base: every asset/route is served under /OGDEX/.
// outDir: build into the parent web app's dist so Vercel serves it at /OGDEX.
export default defineConfig({
  base: "/OGDEX/",
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    outDir: path.resolve(__dirname, "../dist/OGDEX"),
    emptyOutDir: true,
  },
  server: { port: 5173 },
});
