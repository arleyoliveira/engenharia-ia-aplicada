import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/opspilot/",
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
  },
});
