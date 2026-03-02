import { createClient } from "@supabase/supabase-js";

declare const SUPABASE_URL: string;
declare const SUPABASE_PUBLISHABLE_KEY: string;

type PasswordRecoveryStatus = "none" | "pending" | "ready" | "error";

const PASSWORD_RECOVERY_STATUS_KEY = "auth:password-recovery:status";
const PASSWORD_RECOVERY_ERROR_KEY = "auth:password-recovery:error";

const decodeParam = (value: string) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
};

const setPasswordRecoveryState = (status: PasswordRecoveryStatus, errorMessage?: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PASSWORD_RECOVERY_STATUS_KEY, status);
  if (status === "error" && errorMessage) {
    window.sessionStorage.setItem(PASSWORD_RECOVERY_ERROR_KEY, errorMessage);
  } else {
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_ERROR_KEY);
  }
};

export const getPasswordRecoveryState = (): { status: PasswordRecoveryStatus; errorMessage: string | null } => {
  if (typeof window === "undefined") {
    return { status: "none", errorMessage: null };
  }

  const statusRaw = window.sessionStorage.getItem(PASSWORD_RECOVERY_STATUS_KEY);
  const status: PasswordRecoveryStatus =
    statusRaw === "pending" || statusRaw === "ready" || statusRaw === "error" ? statusRaw : "none";
  const errorMessage = window.sessionStorage.getItem(PASSWORD_RECOVERY_ERROR_KEY);
  return { status, errorMessage };
};

export const clearPasswordRecoveryState = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_STATUS_KEY);
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_ERROR_KEY);
};

const bootstrapPasswordRecoveryStateFromUrl = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/auth/reset-password") return;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);

  const errorDescription = hashParams.get("error_description") || queryParams.get("error_description");
  if (errorDescription) {
    setPasswordRecoveryState("error", decodeParam(errorDescription));
    return;
  }

  const hasHashRecoveryTokens =
    hashParams.get("type") === "recovery" &&
    !!hashParams.get("access_token") &&
    !!hashParams.get("refresh_token");
  const hasTokenHash = queryParams.get("type") === "recovery" && !!queryParams.get("token_hash");
  const hasCode = !!queryParams.get("code");

  if (hasHashRecoveryTokens || hasTokenHash || hasCode) {
    setPasswordRecoveryState("pending");
  }
};

bootstrapPasswordRecoveryStateFromUrl();

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    const recoveryState = getPasswordRecoveryState();

    if (event === "PASSWORD_RECOVERY") {
      setPasswordRecoveryState("ready");
      return;
    }

    // Some Supabase flows emit SIGNED_IN after consuming reset URL params.
    if (event === "SIGNED_IN" && recoveryState.status === "pending") {
      setPasswordRecoveryState("ready");
      return;
    }

    if (event === "SIGNED_OUT" && recoveryState.status !== "error") {
      clearPasswordRecoveryState();
    }
  });
}
