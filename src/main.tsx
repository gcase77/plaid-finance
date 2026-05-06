import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FinanceAdmin from "./admin/FinanceAdmin";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FinanceAdmin />
  </StrictMode>
);
