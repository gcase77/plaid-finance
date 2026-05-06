import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@refinedev/core": path.resolve(__dirname, "src/refinedev/core.tsx"),
    },
  },
  define: {
    SUPABASE_URL: JSON.stringify(process.env.SUPABASE_URL ?? ""),
    SUPABASE_PUBLISHABLE_KEY: JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY ?? ""),
    APP_BASE_URL: JSON.stringify(process.env.APP_BASE_URL ?? ""),
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
