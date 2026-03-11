import { useOutletContext } from "react-router-dom";
import MainTab from "./MainTab";
import type { AppShellContextValue } from "./appShellContext";

export default function HomeRoute() {
  const context = useOutletContext<AppShellContextValue>();

  return (
    <MainTab
      userEmail={context.userEmail}
      signOut={context.signOut}
      linkBank={context.linkBank}
      loadingItems={context.loadingItems}
      items={context.items}
      accountsByItem={context.accountsByItem}
    />
  );
}
