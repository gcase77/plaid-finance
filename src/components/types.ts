export type TabKey = "main" | "transactions";
export type TextMode = "contains" | "not" | "null";
export type AmountMode = "" | "gt" | "lt";
export type TagType = "income_bucket_1" | "income_bucket_2" | "spending_bucket_1" | "spending_bucket_2" | "meta";
export type TagStateFilter = "all" | "untagged" | "tagged";
export type Tag = { id: number; name: string; type: TagType; user_id: string };

export type Item = { id: string; institution_name?: string | null };
export type Account = { id: string; name?: string | null; official_name?: string | null; mask?: string | null; type?: string | null };

export type TransactionBaseRow = {
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

export type TransactionMetaRow = {
  transaction_id?: string;
  account_transfer_group?: string | null;
  bucket_1_tag_id?: number | null;
  bucket_2_tag_id?: number | null;
  meta_tag_id?: number | null;
};

export type TransactionMerged = TransactionBaseRow & TransactionMetaRow;
export type Txn = TransactionMerged;

export type PieCategory = { category: string; amount: number };
export type VisualizePayload = {
  income?: { categories?: PieCategory[]; count?: number; total?: number };
  spending?: { categories?: PieCategory[]; count?: number; total?: number };
  error?: string;
};

export type TransferTxn = {
  id: string;
  amount: number;
  account_id: string;
  datetime?: string | null;
  authorized_datetime?: string | null;
  name?: string | null;
  merchant_name?: string | null;
  iso_currency_code?: string | null;
  account_name?: string | null;
  account_official_name?: string | null;
};

export type TransferPair = {
  pairId: string;
  amount: number;
  dayGap: number;
  reason: string;
  outflow: TransferTxn;
  inflow: TransferTxn;
};

export type TransferPreviewResponse = {
  params?: {
    startDate?: string | null;
    endDate?: string | null;
    includePending?: boolean;
    amountTolerance?: number;
    dayRangeTolerance?: number;
  };
  summary?: {
    scanned?: number;
    candidates?: number;
    predicted?: number;
    ambiguous_transactions?: number;
    ambiguous_pairs?: number;
  };
  pairs?: TransferPair[];
  ambiguous_pairs?: TransferPair[];
};

export type RecognizedTransferGroup = {
  groupId: string;
  rows: TransferTxn[];
  pair?: TransferPair | null;
};

export type RecognizedTransfersResponse = {
  count?: number;
  groups?: RecognizedTransferGroup[];
};

export type BudgetRuleType = "flat_rate" | "percent_of_income";
export type CalendarWindow = "week" | "month";
export type RolloverOption = "none" | "surplus" | "deficit" | "both";

export type BudgetRule = {
  id: number;
  user_id: string;
  tag_id: number;
  name: string;
  start_date: string;
  type: BudgetRuleType;
  flat_amount: number | null;
  percent: number | null;
  calendar_window: CalendarWindow;
  rollover_options: RolloverOption;
  tag: Tag;
};

export type PeriodHistory = {
  start: string;
  end: string;
  budget: number;
  spending: number;
  delta: number;
  carry_after: number;
  income?: number;
};

export type BudgetRuleStatus = {
  rule_id: number;
  carry: number;
  current_period: {
    start: string | null;
    end: string | null;
    base_budget: number;
    effective_budget: number;
    spending: number;
    remaining: number;
  };
  period_history: PeriodHistory[];
};
