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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts";
          }

          if (id.includes("@supabase")) {
            return "supabase";
          }

          if (id.includes("@radix-ui") || id.includes("class-variance-authority") || id.includes("clsx")) {
            return "ui";
          }

          if (id.includes("react-router") || id.includes("@tanstack/react-query")) {
            return "app-core";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});
