import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [react()],
  define: {
    SUPABASE_URL: JSON.stringify(process.env.SUPABASE_URL ?? ""),
    SUPABASE_PUBLISHABLE_KEY: JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY ?? ""),
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
