export const APP_THEME_KEY = "fundsup:theme";

export type AppThemeMode = "light" | "dark" | "system";

export function readStoredTheme(): AppThemeMode {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(APP_THEME_KEY);
  if (v === "dark" || v === "light") return v;
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyStoredTheme(): void {
  if (typeof document === "undefined") return;
  const mode = readStoredTheme();
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

export function persistTheme(mode: AppThemeMode): void {
  if (mode === "system") window.localStorage.removeItem(APP_THEME_KEY);
  else window.localStorage.setItem(APP_THEME_KEY, mode);
  applyStoredTheme();
}

export function installThemeSchemeListener(): void {
  if (typeof window === "undefined") return;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (readStoredTheme() === "system") applyStoredTheme();
  });
}
