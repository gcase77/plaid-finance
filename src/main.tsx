import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

declare const SUPABASE_URL: string | undefined;
declare const SUPABASE_PUBLISHABLE_KEY: string | undefined;

const supabaseUrl = SUPABASE_URL;
const supabasePublishableKey = SUPABASE_PUBLISHABLE_KEY;

if (supabaseUrl && supabasePublishableKey) {
  (window as any).SUPABASE_URL = supabaseUrl;
  (window as any).SUPABASE_PUBLISHABLE_KEY = supabasePublishableKey;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
