import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8084",
    trace: "on-first-retry",
  },
});
