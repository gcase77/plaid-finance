export type RuntimeAuthMode = "supabase" | "dev";

export const runtimeAuthMode: RuntimeAuthMode = process.env.AUTH_MODE === "dev" ? "dev" : "supabase";
