import type { Tag, Txn } from "../types";
import {
  formatTxnDetectedCategory,
  getTxnDateOnly,
  normalizeDetectedCategoryValue,
  TAG_COLOR_PALETTE
} from "../../utils/transactionUtils";

export type TrendPieGrouping = "detected" | "buckets" | "meta";

export type TrendPieSlice = {
  key: string;
  label: string;
  amount: number;
  transactions: Txn[];
};

const SPENDING_TYPES = new Set(["spending_bucket_1", "spending_bucket_2"]);
const INCOME_TYPES = new Set(["income_bucket_1", "income_bucket_2"]);

export function filterTrendsTransactions(txns: Txn[], startIso: string, endIso: string): Txn[] {
  const needDate = Boolean(startIso || endIso);
  return txns.filter((t) => {
    if (t.account_transfer_group) return false;
    const d = getTxnDateOnly(t);
    if (needDate) {
      if (!d) return false;
      if (startIso && d < startIso) return false;
      if (endIso && d > endIso) return false;
    }
    return true;
  });
}

function metaComboLabel(sortedIds: number[], tagMap: Map<number, Tag>): string {
  if (!sortedIds.length) return "No meta tags";
  const names = sortedIds.map((id) => tagMap.get(id)?.name ?? `#${id}`);
  if (names.length === 1) return `only ${names[0]}`;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function bucketKeyAndLabel(
  t: Txn,
  tagMap: Map<number, Tag>,
  allowedTypes: Set<string>,
  emptyLabel: string
): { key: string; label: string } {
  const ids = [t.bucket_1_tag_id, t.bucket_2_tag_id].filter(
    (id): id is number => id != null && allowedTypes.has(tagMap.get(id)?.type ?? "")
  );
  const uniq = [...new Set(ids)].sort((a, b) => a - b);
  if (!uniq.length) return { key: "__untagged__", label: emptyLabel };
  const label = uniq
    .map((id) => tagMap.get(id)?.name ?? `#${id}`)
    .sort((a, b) => a.localeCompare(b))
    .join(" and ");
  return { key: uniq.join(","), label };
}

function detectedKeyAndLabel(t: Txn): { key: string; label: string } {
  const cat = t.personal_finance_category;
  const raw = cat && typeof cat === "object" ? (cat as { primary?: string; detailed?: string }).detailed
    ?? (cat as { primary?: string }).primary
    : null;
  const key = normalizeDetectedCategoryValue(raw) || "__uncategorized__";
  const label = formatTxnDetectedCategory(t.personal_finance_category) || "Uncategorized";
  return { key, label };
}

function metaKeyAndLabel(t: Txn): { key: string; label: string } {
  const sorted = [...new Set(t.meta_tag_ids ?? [])].sort((a, b) => a - b);
  const key = sorted.length ? sorted.join(",") : "__no_meta__";
  return { key, label: "" };
}

function metaLabelForKey(key: string, tagMap: Map<number, Tag>): string {
  if (key === "__no_meta__") return "No meta tags";
  const sortedIds = key.split(",").map(Number);
  return metaComboLabel(sortedIds, tagMap);
}

/** Flow-of-funds + callers: meta combo for an arbitrary txn (income or spending). */
export function txnMetaFlowGroup(t: Txn, tagMap: Map<number, Tag>): { key: string; label: string } {
  const { key } = metaKeyAndLabel(t);
  return { key, label: metaLabelForKey(key, tagMap) };
}

export function txnIncomeBucketFlowGroup(t: Txn, tagMap: Map<number, Tag>): { key: string; label: string } | null {
  if ((t.amount ?? 0) >= 0) return null;
  return bucketKeyAndLabel(t, tagMap, INCOME_TYPES, "No income tag");
}

export function txnSpendingBucketFlowGroup(t: Txn, tagMap: Map<number, Tag>): { key: string; label: string } | null {
  if ((t.amount ?? 0) <= 0) return null;
  return bucketKeyAndLabel(t, tagMap, SPENDING_TYPES, "No spending tag");
}

export function txnDetectedFlowGroup(t: Txn): { key: string; label: string } | null {
  if ((t.amount ?? 0) === 0) return null;
  return detectedKeyAndLabel(t);
}

function accumulate(map: Map<string, TrendPieSlice>, key: string, label: string, amount: number, t: Txn) {
  const prev = map.get(key);
  if (prev) {
    prev.amount += amount;
    prev.transactions.push(t);
  } else {
    map.set(key, { key, label, amount, transactions: [t] });
  }
}

export function buildTrendPieSlices(
  txns: Txn[],
  side: "spending" | "income",
  grouping: TrendPieGrouping,
  tagMap: Map<number, Tag>
): TrendPieSlice[] {
  const filtered = txns.filter((t) => {
    const a = t.amount ?? 0;
    if (a === 0) return false;
    return side === "spending" ? a > 0 : a < 0;
  });
  const map = new Map<string, TrendPieSlice>();
  const contrib = (t: Txn, raw: number) => (side === "spending" ? raw : Math.abs(raw));

  for (const t of filtered) {
    const amt = t.amount ?? 0;
    const a = contrib(t, amt);
    if (grouping === "detected") {
      const { key, label } = detectedKeyAndLabel(t);
      accumulate(map, key, label, a, t);
    } else if (grouping === "buckets") {
      const { key, label } = bucketKeyAndLabel(
        t,
        tagMap,
        side === "spending" ? SPENDING_TYPES : INCOME_TYPES,
        side === "spending" ? "No spending tag" : "No income tag"
      );
      accumulate(map, key, label, a, t);
    } else {
      const { key, label } = txnMetaFlowGroup(t, tagMap);
      accumulate(map, key, label, a, t);
    }
  }
  return [...map.values()].sort((x, y) => y.amount - x.amount);
}

export function sliceColors(slices: TrendPieSlice[]): Map<string, string> {
  const m = new Map<string, string>();
  slices.forEach((s, i) => m.set(s.key, TAG_COLOR_PALETTE[i % TAG_COLOR_PALETTE.length]));
  return m;
}
