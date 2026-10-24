import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En développement, /api est proxifié vers Django : même origine => cookies de session et CSRF sans CORS.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
  test: { environment: "node" },
});
