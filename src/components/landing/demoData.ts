import type { Account, BudgetRule, Item, Tag, Txn } from "../types";

export const DEMO_USER_ID = "demo-user";

export const DEMO_TAGS: Tag[] = [
  { id: 1, name: "Salary", type: "income_bucket_1", user_id: DEMO_USER_ID, color: "#2a9d8f" },
  { id: 2, name: "Freelance", type: "income_bucket_1", user_id: DEMO_USER_ID, color: "#00a6fb" },
  { id: 3, name: "Groceries", type: "spending_bucket_1", user_id: DEMO_USER_ID, color: "#ff6b35" },
  { id: 4, name: "Dining", type: "spending_bucket_1", user_id: DEMO_USER_ID, color: "#e63946" },
  { id: 5, name: "Bills", type: "spending_bucket_1", user_id: DEMO_USER_ID, color: "#3358ff" },
  { id: 6, name: "Entertainment", type: "spending_bucket_1", user_id: DEMO_USER_ID, color: "#7c5cff" },
  { id: 7, name: "Essential", type: "meta", user_id: DEMO_USER_ID, color: "#5b6677" },
  { id: 8, name: "Discretionary", type: "meta", user_id: DEMO_USER_ID, color: "#ffbe0b" }
];

export const DEMO_ITEMS: Item[] = [
  { id: "item-chase", institution_name: "Chase", inst_color: "#117ACA" },
  { id: "item-amex", institution_name: "American Express", inst_color: "#006FCF" }
];

export const DEMO_ACCOUNTS: Record<string, Account[]> = {
  "item-chase": [
    {
      id: "acct-checking",
      name: "Total Checking",
      official_name: "Chase Total Checking",
      mask: "4821",
      type: "depository",
      subtype: "checking",
      balances: { current: 8420.67, available: 8312.45, iso_currency_code: "USD" }
    },
    {
      id: "acct-savings",
      name: "Premier Savings",
      official_name: "Chase Premier Savings",
      mask: "9103",
      type: "depository",
      subtype: "savings",
      balances: { current: 22450.0, available: 22450.0, iso_currency_code: "USD" }
    }
  ],
  "item-amex": [
    {
      id: "acct-amex",
      name: "Gold Card",
      official_name: "American Express Gold Card",
      mask: "4420",
      type: "credit",
      subtype: "credit card",
      balances: { current: 1842.33, available: 8157.67, limit: 10000, iso_currency_code: "USD" }
    }
  ]
};

function txn(
  id: string,
  date: string,
  name: string,
  amount: number,
  opts: Partial<Txn> = {}
): Txn {
  return {
    transaction_id: id,
    datetime: `${date}T12:00:00Z`,
    name,
    merchant_name: opts.merchant_name ?? name,
    amount,
    item_id: opts.item_id ?? "item-chase",
    account_id: opts.account_id ?? "acct-checking",
    institution_name: opts.institution_name ?? "Chase",
    account_name: opts.account_name ?? "Total Checking",
    account_official_name: opts.account_official_name ?? "Chase Total Checking",
    iso_currency_code: "USD",
    personal_finance_category: opts.personal_finance_category ?? null,
    bucket_1_tag_id: opts.bucket_1_tag_id ?? null,
    bucket_2_tag_id: opts.bucket_2_tag_id ?? null,
    meta_tag_ids: opts.meta_tag_ids ?? []
  };
}

/** Demo transactions spanning Jan–Apr 2026. Negative = income, positive = spending. */
export const DEMO_TRANSACTIONS: Txn[] = [
  // January income
  txn("t-001", "2026-01-02", "ACME CORP PAYROLL", -5200.0, {
    bucket_1_tag_id: 1, meta_tag_ids: [7],
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_PAYROLL" }
  }),
  txn("t-002", "2026-01-15", "STRIPE TRANSFER", -1850.0, {
    item_id: "item-chase", account_id: "acct-checking",
    bucket_1_tag_id: 2, meta_tag_ids: [7],
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_OTHER_INCOME" }
  }),
  // January spending
  txn("t-003", "2026-01-03", "Whole Foods Market", 142.18, {
    bucket_1_tag_id: 3, meta_tag_ids: [7],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" }
  }),
  txn("t-004", "2026-01-05", "City Utilities", 186.42, {
    bucket_1_tag_id: 5, meta_tag_ids: [7],
    personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_UTILITIES" }
  }),
  txn("t-005", "2026-01-07", "Netflix", 15.99, {
    bucket_1_tag_id: 6, meta_tag_ids: [8],
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES" }
  }),
  txn("t-006", "2026-01-10", "Blue Bottle Coffee", 8.45, {
    bucket_1_tag_id: 4, meta_tag_ids: [8],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" }
  }),
  txn("t-007", "2026-01-12", "Trader Joe's", 96.33, {
    bucket_1_tag_id: 3, meta_tag_ids: [7],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" }
  }),
  txn("t-008", "2026-01-18", "Spotify", 12.99, {
    bucket_1_tag_id: 6, meta_tag_ids: [8],
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_MUSIC_AND_AUDIO" }
  }),
  txn("t-009", "2026-01-22", "Sweetgreen", 18.75, {
    bucket_1_tag_id: 4, meta_tag_ids: [8],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANT" }
  }),
  txn("t-010", "2026-01-25", "Amazon", 64.2, {
    bucket_1_tag_id: 6, meta_tag_ids: [8],
    personal_finance_category: { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES" }
  }),

  // February
  txn("t-011", "2026-02-02", "ACME CORP PAYROLL", -5200.0, {
    bucket_1_tag_id: 1, meta_tag_ids: [7],
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_PAYROLL" }
  }),
  txn("t-012", "2026-02-04", "Whole Foods Market", 128.9, {
    bucket_1_tag_id: 3, meta_tag_ids: [7],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" }
  }),
  txn("t-013", "2026-02-05", "City Utilities", 192.1, {
    bucket_1_tag_id: 5, meta_tag_ids: [7],
    personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_UTILITIES" }
  }),
  txn("t-014", "2026-02-08", "Nobu", 142.5, {
    item_id: "item-amex", account_id: "acct-amex",
    institution_name: "American Express", account_name: "Gold Card",
    bucket_1_tag_id: 4, meta_tag_ids: [8],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANT" }
  }),
  txn("t-015", "2026-02-12", "Trader Joe's", 88.44, {
    bucket_1_tag_id: 3, meta_tag_ids: [7],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" }
  }),
  txn("t-016", "2026-02-14", "Flower Shop", 52.0, {
    bucket_1_tag_id: 6, meta_tag_ids: [8],
    personal_finance_category: { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES" }
  }),
  txn("t-017", "2026-02-16", "STRIPE TRANSFER", -2100.0, {
    bucket_1_tag_id: 2, meta_tag_ids: [7],
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_OTHER_INCOME" }
  }),
  txn("t-018", "2026-02-20", "Concert Tickets", 89.0, {
    item_id: "item-amex", account_id: "acct-amex",
    institution_name: "American Express", account_name: "Gold Card",
    bucket_1_tag_id: 6, meta_tag_ids: [8],
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_SPORTING_EVENTS" }
  }),
  txn("t-019", "2026-02-22", "Internet Provider", 79.99, {
    bucket_1_tag_id: 5, meta_tag_ids: [7],
    personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_INTERNET_AND_CABLE" }
  }),
  txn("t-020", "2026-02-25", "Blue Bottle Coffee", 9.2, {
    bucket_1_tag_id: 4, meta_tag_ids: [8],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" }
  }),

  // March
  txn("t-021", "2026-03-02", "ACME CORP PAYROLL", -5200.0, {
    bucket_1_tag_id: 1, meta_tag_ids: [7],
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_PAYROLL" }
  }),
  txn("t-022", "2026-03-04", "Whole Foods Market", 156.72, {
    bucket_1_tag_id: 3, meta_tag_ids: [7],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" }
  }),
  txn("t-023", "2026-03-05", "City Utilities", 178.55, {
    bucket_1_tag_id: 5, meta_tag_ids: [7],
    personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_UTILITIES" }
  }),
  txn("t-024", "2026-03-08", "Sweetgreen", 16.4, {
    bucket_1_tag_id: 4, meta_tag_ids: [8],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANT" }
  }),
  txn("t-025", "2026-03-12", "Trader Joe's", 102.18, {
    bucket_1_tag_id: 3, meta_tag_ids: [7],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" }
  }),
  txn("t-026", "2026-03-15", "STRIPE TRANSFER", -1650.0, {
    bucket_1_tag_id: 2, meta_tag_ids: [7],
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_OTHER_INCOME" }
  }),
  txn("t-027", "2026-03-18", "AMC Theatres", 34.5, {
    item_id: "item-amex", account_id: "acct-amex",
    institution_name: "American Express", account_name: "Gold Card",
    bucket_1_tag_id: 6, meta_tag_ids: [8],
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES" }
  }),
  txn("t-028", "2026-03-20", "Uber Eats", 42.8, {
    bucket_1_tag_id: 4, meta_tag_ids: [8],
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANT" }
  }),
  txn("t-029", "2026-03-22", "Netflix", 15.99, {
    bucket_1_tag_id: 6, meta_tag_ids: [8],
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES" }
  }),
  txn("t-030", "2026-03-25", "Internet Provider", 79.99, {
    bucket_1_tag_id: 5, meta_tag_ids: [7],
    personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_INTERNET_AND_CABLE" }
  }),

  // April (some untagged for demo tagging)
  txn("t-031", "2026-04-01", "ACME CORP PAYROLL", -5200.0, {
    bucket_1_tag_id: 1, meta_tag_ids: [7],
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_PAYROLL" }
  }),
  txn("t-032", "2026-04-03", "Whole Foods Market", 134.55, {
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" }
  }),
  txn("t-033", "2026-04-05", "City Utilities", 181.2, {
    bucket_1_tag_id: 5, meta_tag_ids: [7],
    personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_UTILITIES" }
  }),
  txn("t-034", "2026-04-07", "Blue Bottle Coffee", 7.9, {
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" }
  }),
  txn("t-035", "2026-04-10", "Trader Joe's", 91.6, {
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" }
  }),
  txn("t-036", "2026-04-12", "Sweetgreen", 19.25, {
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANT" }
  }),
  txn("t-037", "2026-04-15", "STRIPE TRANSFER", -1920.0, {
    bucket_1_tag_id: 2, meta_tag_ids: [7],
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_OTHER_INCOME" }
  }),
  txn("t-038", "2026-04-18", "Spotify", 12.99, {
    bucket_1_tag_id: 6, meta_tag_ids: [8],
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_MUSIC_AND_AUDIO" }
  }),
  txn("t-039", "2026-04-20", "Amazon", 78.45, {
    personal_finance_category: { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES" }
  }),
  txn("t-040", "2026-04-22", "Nobu", 128.0, {
    item_id: "item-amex", account_id: "acct-amex",
    institution_name: "American Express", account_name: "Gold Card",
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANT" }
  }),
  txn("t-041", "2026-04-24", "Internet Provider", 79.99, {
    bucket_1_tag_id: 5, meta_tag_ids: [7],
    personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_INTERNET_AND_CABLE" }
  }),
  txn("t-042", "2026-04-26", "Concert Tickets", 95.0, {
    item_id: "item-amex", account_id: "acct-amex",
    institution_name: "American Express", account_name: "Gold Card",
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_SPORTING_EVENTS" }
  })
];

export const DEMO_BUDGET_RULES: BudgetRule[] = [
  {
    id: 1,
    user_id: DEMO_USER_ID,
    rule_source_type: "tag",
    tag_id: 3,
    detected_category: null,
    name: "Groceries",
    start_date: "2026-01-01",
    type: "flat_rate",
    flat_amount: 500,
    percent: null,
    calendar_window: "month",
    rollover_options: "surplus",
    cache: [
      { start_date: "2026-01-01", end_date: "2026-01-31", base_budget: 500, effective_budget: 500, balance: 132.49, associated_spend: 367.51, associated_income: 0 },
      { start_date: "2026-02-01", end_date: "2026-02-28", base_budget: 500, effective_budget: 632.49, balance: 55.15, associated_spend: 577.34, associated_income: 0 },
      { start_date: "2026-03-01", end_date: "2026-03-31", base_budget: 500, effective_budget: 555.15, balance: 196.25, associated_spend: 358.9, associated_income: 0 },
      { start_date: "2026-04-01", end_date: "2026-04-30", base_budget: 500, effective_budget: 696.25, balance: null, associated_spend: 226.15, associated_income: 0 }
    ]
  },
  {
    id: 2,
    user_id: DEMO_USER_ID,
    rule_source_type: "tag",
    tag_id: 4,
    detected_category: null,
    name: "Dining out",
    start_date: "2026-01-01",
    type: "flat_rate",
    flat_amount: 300,
    percent: null,
    calendar_window: "month",
    rollover_options: "none",
    cache: [
      { start_date: "2026-01-01", end_date: "2026-01-31", base_budget: 300, effective_budget: 300, balance: 0, associated_spend: 27.2, associated_income: 0 },
      { start_date: "2026-02-01", end_date: "2026-02-28", base_budget: 300, effective_budget: 300, balance: 0, associated_spend: 151.7, associated_income: 0 },
      { start_date: "2026-03-01", end_date: "2026-03-31", base_budget: 300, effective_budget: 300, balance: 0, associated_spend: 59.2, associated_income: 0 },
      { start_date: "2026-04-01", end_date: "2026-04-30", base_budget: 300, effective_budget: 300, balance: null, associated_spend: 155.15, associated_income: 0 }
    ]
  },
  {
    id: 3,
    user_id: DEMO_USER_ID,
    rule_source_type: "all_spending",
    tag_id: null,
    detected_category: null,
    name: "Total spending cap",
    start_date: "2026-01-01",
    type: "percent_of_income",
    flat_amount: null,
    percent: 60,
    calendar_window: "month",
    rollover_options: "both",
    cache: [
      { start_date: "2026-01-01", end_date: "2026-01-31", base_budget: 4230, effective_budget: 4230, balance: 1205.5, associated_spend: 526.56, associated_income: 7050 },
      { start_date: "2026-02-01", end_date: "2026-02-28", base_budget: 4380, effective_budget: 5585.5, balance: 3892.1, associated_spend: 693.13, associated_income: 7300 },
      { start_date: "2026-03-01", end_date: "2026-03-31", base_budget: 4110, effective_budget: 8002.1, balance: 6234.8, associated_spend: 767.33, associated_income: 6850 },
      { start_date: "2026-04-01", end_date: "2026-04-30", base_budget: 4272, effective_budget: 10506.8, balance: null, associated_spend: 738.83, associated_income: 7120 }
    ]
  }
];

export const DEMO_TAG_MAP = new Map(DEMO_TAGS.map((t) => [t.id, t]));
