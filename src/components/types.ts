export type AuthMode = "existing" | "new";
export type TabKey = "main" | "transactions" | "visualize";
export type TextMode = "contains" | "not" | "null";
export type AmountMode = "" | "gt" | "lt";

export type Item = { id: string; institution_name?: string | null };
export type Account = { id: string; name?: string | null; official_name?: string | null; mask?: string | null; type?: string | null };

export type Txn = {
  transaction_id?: string;
  name?: string | null;
  merchant_name?: string | null;
  amount?: number;
  item_id?: string | null;
  account_id?: string | null;
  institution_name?: string | null;
  account_name?: string | null;
  account_official_name?: string | null;
  iso_currency_code?: string | null;
  original_description?: string | null;
  personal_finance_category_icon_url?: string | null;
  counterparties?: Array<{ logo_url?: string | null }> | { logo_url?: string | null } | null;
  datetime?: string | null;
  authorized_datetime?: string | null;
  personal_finance_category?: { primary?: string | null; detailed?: string | null } | null;
};

export type PieCategory = { category: string; amount: number };
export type VisualizePayload = {
  income?: { categories?: PieCategory[]; count?: number; total?: number };
  spending?: { categories?: PieCategory[]; count?: number; total?: number };
  error?: string;
};
