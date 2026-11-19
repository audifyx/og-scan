import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// Hub DEX is mounted as a sub-app of OG Scan at orbitx-world.pages.dev/hub-dex.
// It is the Terminal-grade DEX UI (kept from the pre-restore ogdex), renamed
// so the old (pre-Terminal) DEX can be the main one at /ORBITX_DEX.
export default defineConfig({
  base: "/hub-dex/",
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    outDir: path.resolve(__dirname, "../dist/hub-dex"),
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Only split clearly leaf-level libs used on the initial load.
        // @solana stays in the async Launch chunk (its only importer), so it
        // never ships in the initial Discovery bundle.
        // NOTE: Do NOT manually chunk react/react-dom — it breaks named imports (lazy, Suspense).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("lightweight-charts")) return "charts";
          if (id.includes("lucide-react")) return "icons";
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5173 },
});
