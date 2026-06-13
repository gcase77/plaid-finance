export type TagType = "income_bucket_1" | "income_bucket_2" | "spending_bucket_1" | "spending_bucket_2" | "meta";
export type Tag = { id: number; name: string; type: TagType; user_id: string; color?: string | null };

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
  netting_group?: string | null;
  bucket_1_tag_id?: number | null;
  bucket_2_tag_id?: number | null;
  meta_tag_ids?: number[];
};

export type Txn = TransactionBaseRow & TransactionMetaRow;
