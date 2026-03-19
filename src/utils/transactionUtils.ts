import type { TagType, Txn } from "../components/types";

export const getTxnDateValue = (t: Txn) => t.datetime || t.authorized_datetime || "";
export const getTxnDateOnly = (t: Txn) => {
  const raw = getTxnDateValue(t);
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
};
export const formatTxnDate = (t: Txn) => {
  const dateOnly = getTxnDateOnly(t);
  if (!dateOnly) return "";
  const [year, month, day] = dateOnly.split("-");
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const monthLabel = months[Math.max(0, Number(month) - 1)] || month;
  return `${monthLabel} ${Number(day)}, ${year}`;
};

export const getTxnIconUrl = (t: Txn) => {
  const cp = t.counterparties;
  const logo = Array.isArray(cp) ? cp.find((x) => x?.logo_url)?.logo_url : cp?.logo_url;
  if (logo) {
    try {
      new URL(logo);
      return logo;
    } catch {
      return t.personal_finance_category_icon_url || "";
    }
  }
  return t.personal_finance_category_icon_url || "";
};

export const formatTxnAmount = (t: Txn) => 
  `${String(t.iso_currency_code || "").toUpperCase() === "USD" ? "$" : ""} ${Number(t.amount || 0).toFixed(2)}`;

export const normalizeDetectedCategoryValue = (value?: string | null): string =>
  String(value || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

const LOWERCASE_CATEGORY_WORDS = new Set(["and", "of", "from"]);

export const formatCategoryLabel = (value?: string | null): string => {
  const normalized = String(value || "").trim().replace(/_/g, " ");
  if (!normalized) return "";
  return normalized
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (LOWERCASE_CATEGORY_WORDS.has(lower)) return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
};

export const formatCategorySubLabel = (primary?: string | null, value?: string | null): string => {
  const rawPrimary = String(primary || "").trim();
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  const prefix = rawPrimary ? `${rawPrimary}_` : "";
  const trimmed = prefix && rawValue.startsWith(prefix) ? rawValue.slice(prefix.length) : rawValue;
  return formatCategoryLabel(trimmed);
};

export const formatTxnDetectedCategory = (category?: Txn["personal_finance_category"]): string => {
  const primary = String(category?.primary || "").trim();
  const detailed = String(category?.detailed || "").trim();
  if (!primary && !detailed) return "";
  if (!primary) return formatCategoryLabel(detailed);
  if (!detailed || detailed === primary) return formatCategoryLabel(primary);
  const primaryLabel = formatCategoryLabel(primary);
  const detailedLabel = formatCategorySubLabel(primary, detailed);
  if (!detailedLabel || detailedLabel === primaryLabel) return primaryLabel;
  return `${primaryLabel}, ${detailedLabel}`;
};

export const TAG_COLOR_PALETTE = [
  "#e63946",
  "#ff6b35",
  "#ffbe0b",
  "#2a9d8f",
  "#00a6fb",
  "#4361ee",
  "#7209b7",
  "#b5179e",
  "#f15bb5",
  "#8ac926",
  "#198754",
  "#6c757d"
] as const;

const DEFAULT_TAG_COLORS: Record<TagType, string> = {
  income_bucket_1: "#198754",
  income_bucket_2: "#2a9d8f",
  spending_bucket_1: "#e63946",
  spending_bucket_2: "#ff6b35",
  meta: "#6c757d"
};

export function getDefaultTagColor(type: TagType): string {
  return DEFAULT_TAG_COLORS[type];
}

export function getDisplayTagColor(type: TagType, color?: string | null): string {
  return color && color.trim() ? color : getDefaultTagColor(type);
}

export function getTextColorForBackground(hexColor: string): "#000" | "#fff" {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#fff";
  const rgb = parseInt(hex, 16);
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? "#000" : "#fff";
}
