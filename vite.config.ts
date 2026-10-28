import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { allowedHosts: true },
  build: { chunkSizeWarningLimit: 1200 },
  test: { environment: "node" },
});
