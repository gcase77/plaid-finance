import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { usePlaidData } from "../../hooks/usePlaidData";
import { supabase } from "../../lib/supabase";
import MainTab from "./MainTab";

export default function MainPage() {
  const [session, setSession] = useState<Session | null>(null);
  const userId = session?.user?.id ?? null;
  const token = session?.access_token ?? null;
  const userEmail = session?.user?.email ?? "";
  const plaidData = usePlaidData(userId, token);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!userId || !token) return;
    void plaidData.loadItems(userId, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  return (
    <MainTab
      userEmail={userEmail}
      signOut={() => supabase.auth.signOut()}
      linkBank={plaidData.linkBank}
      deleteItem={plaidData.deleteItem}
      refreshItemAccounts={plaidData.refreshItemAccounts}
      loadingItems={plaidData.loadingItems}
      items={plaidData.items}
      accountsByItem={plaidData.accountsByItem}
    />
  );
}
