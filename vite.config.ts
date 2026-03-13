import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [react()],
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
