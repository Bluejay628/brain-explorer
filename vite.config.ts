/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The front end runs on :5173 during development. Any request to /api is
// forwarded to the Express server on :8787, so API keys stay server-side.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
