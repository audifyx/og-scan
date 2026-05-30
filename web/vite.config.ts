import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Polyfill Node.js Buffer for browser
      buffer: "buffer",
    },
  },
  define: {
    // Make Buffer available globally in browser
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["buffer"],
  },
}));
