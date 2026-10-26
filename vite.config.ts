/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The front end runs on :5173 during development. Any request to /api is
// forwarded to the Express server (PORT in .env, default 8787), so API keys stay server-side.
export default defineConfig(({ mode }) => {
  const apiPort = loadEnv(mode, process.cwd(), "").PORT || "8787";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": `http://localhost:${apiPort}` },
    },
    build: { chunkSizeWarningLimit: 1200 },
    test: { environment: "node", include: ["tests/**/*.test.ts"] },
  };
});
