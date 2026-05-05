import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import MfaChallenge from "./MfaChallenge";

type MfaState = "checking" | "not-required" | "required";

export default function RequireAuth() {
  const [claims, setClaims] = useState<object | null | undefined>(undefined);
  const [mfaState, setMfaState] = useState<MfaState>("checking");
  const refreshIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const refreshAuthState = async () => {
      const refreshId = refreshIdRef.current + 1;
      refreshIdRef.current = refreshId;
      const { data } = await supabase.auth.getClaims();
      if (cancelled || refreshId !== refreshIdRef.current) return;

      const nextClaims = data?.claims ?? null;
      setClaims(nextClaims);

      if (!nextClaims) {
        setMfaState("not-required");
        return;
      }

      const { data: assurance, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled || refreshId !== refreshIdRef.current) return;

      if (error) {
        console.error("MFA assurance level check error:", error);
        setMfaState("required");
        return;
      }

      if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
        setMfaState("required");
        return;
      }
      setMfaState("not-required");
    };

    void refreshAuthState();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void refreshAuthState();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (claims === undefined || mfaState === "checking") return null;
  if (!claims) return <Navigate to="/auth" replace />;
  if (mfaState === "required") return <MfaChallenge onVerified={() => setMfaState("not-required")} />;
  return <Outlet />;
}
