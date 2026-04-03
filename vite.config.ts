import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { assertFrontendEnvConsistency } from "./scripts/lib/frontend-env-consistency.mjs";

assertFrontendEnvConsistency(__dirname);

// https://vitejs.dev/config/
export default defineConfig({
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
    },
  },
});
