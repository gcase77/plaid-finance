export type SessionUser = { id: string; email?: string | null };
export type Session = { user?: SessionUser; access_token?: string };
export type SupabaseClient = {
  auth: {
    onAuthStateChange: (cb: (_event: string, session: Session | null) => void | Promise<void>) => void;
    getSession: () => Promise<{ data?: { session?: Session | null } }>;
    signInWithPassword: (input: { email: string; password: string }) => Promise<{ error?: { message?: string } | null }>;
    signUp: (input: { email: string; password: string }) => Promise<{ error?: { message?: string } | null }>;
    signOut: () => Promise<void>;
  };
};

declare global {
  interface Window {
    supabase?: { createClient?: (url: string, key: string) => SupabaseClient };
    Plaid?: { 
      create: (opts: { token: string; onSuccess: (publicToken: string) => void | Promise<void> }) => { open: () => void } 
    };
    Chart?: {
      new (canvas: HTMLCanvasElement, config: unknown): {
        destroy: () => void;
      };
    };
    Plotly?: {
      react: (el: HTMLElement, data: unknown[], layout?: unknown, config?: unknown) => void;
      purge: (el: HTMLElement) => void;
    };
  }
}
