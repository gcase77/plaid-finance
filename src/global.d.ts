declare global {
  interface Window {
    Plaid?: {
      create: (opts: {
        token: string;
        receivedRedirectUri?: string;
        onSuccess: (publicToken: string) => void | Promise<void>;
        onExit?: (err: unknown, meta: unknown) => void;
      }) => { open: () => void; exit?: () => void };
    };
  }
}
export {};
