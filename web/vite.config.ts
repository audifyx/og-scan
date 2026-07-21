import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // Polyfill Node.js builtins + globals for the browser. Several Solana /
    // Metaplex libs (notably umi-bundle-defaults' node-fetch-based HTTP layer)
    // read Node builtins like `stream`/`url` and the `process`/`Buffer` globals
    // at module-evaluation time; without these shims the lazily-loaded NFT
    // chunks throw and trip the ErrorBoundary.
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["buffer"],
  },
  build: {
    rollupOptions: {
      // Multi-page: static marketing splash (index.html) + the React SPA (app.html).
      input: {
        main: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "app.html"),
      },
    },
  },
}));
