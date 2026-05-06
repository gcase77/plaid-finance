import type { RefineResource } from "../providers/types";

export const resources: RefineResource[] = [
  { name: "items", list: "/" },
  { name: "accounts" },
  { name: "transactions", list: "/transactions" },
  { name: "transaction_meta" },
  { name: "tags" },
  { name: "budget_rules", list: "/tools" }
];
