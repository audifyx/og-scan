import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

function spaAppHtml() {
  const rewrite = (req: { url?: string }) => {
    const raw = req.url || "/";
    const pathOnly = raw.split("?")[0] ?? "/";
    if (
      pathOnly.startsWith("/src/") ||
      pathOnly.startsWith("/@") ||
      pathOnly.startsWith("/node_modules") ||
      pathOnly.startsWith("/api/") ||
      pathOnly.startsWith("/ORBITX_DEX")
    ) {
      return;
    }
    if (pathOnly === "/" || pathOnly === "/index.html" || pathOnly === "/splash" || pathOnly === "/beta") {
      return;
    }
    if (/\.[a-zA-Z0-9]+$/.test(pathOnly) && !pathOnly.endsWith(".html")) {
      return;
    }
    const qs = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
    req.url = `/app.html${qs}`;
  };
  return {
    name: "spa-app-html",
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, _res: unknown, next: () => void) => void) => void } }) {
      return () => {
        server.middlewares.use((req, _res, next) => {
          rewrite(req);
          next();
        });
      };
    },
    configurePreviewServer(server: { middlewares: { use: (fn: (req: { url?: string }, _res: unknown, next: () => void) => void) => void } }) {
      return () => {
        server.middlewares.use((req, _res, next) => {
          rewrite(req);
          next();
        });
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    spaAppHtml(),
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
