import { useEffect } from "react";
import { usePlaidData } from "../../hooks/usePlaidData";
import { useAppAuth } from "../../providers/authContext";
import MainTab from "./MainTab";

export default function MainPage() {
  const { userId, token, userEmail, signOut } = useAppAuth();
  const plaidData = usePlaidData(userId, token);

  useEffect(() => {
    if (!userId || !token) return;
    void plaidData.loadItems(userId, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  return (
    <MainTab
      userEmail={userEmail}
      signOut={signOut}
      linkBank={plaidData.linkBank}
      deleteItem={plaidData.deleteItem}
      refreshItemAccounts={plaidData.refreshItemAccounts}
      loadingItems={plaidData.loadingItems}
      items={plaidData.items}
      accountsByItem={plaidData.accountsByItem}
    />
  );
}
