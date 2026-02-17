import type { Txn } from "../components/types";

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
