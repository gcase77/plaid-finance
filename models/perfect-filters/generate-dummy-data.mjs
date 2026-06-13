import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "dummy-data.json");

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x9e3779b9);

const tags = [
  { id: 1, name: "Salary", type: "income_bucket_1", user_id: "demo", color: "#198754" },
  { id: 2, name: "Groceries", type: "spending_bucket_1", user_id: "demo", color: "#e63946" },
  { id: 3, name: "Travel", type: "spending_bucket_2", user_id: "demo" },
  { id: 4, name: "Rent", type: "spending_bucket_1", user_id: "demo", color: "#b5179e" },
  { id: 5, name: "Side income", type: "income_bucket_2", user_id: "demo", color: "#2a9d8f" },
  { id: 10, name: "Reimbursable", type: "meta", user_id: "demo", color: "#4361ee" },
  { id: 11, name: "Tax deductible", type: "meta", user_id: "demo", color: "#7209b7" },
];

const banks = [
  { item_id: "bank_chase", institution_name: "Chase", accounts: [
    { account_id: "acct_checking", account_name: "Total Checking" },
    { account_id: "acct_cc", account_name: "Sapphire Preferred", account_official_name: "Chase Sapphire Preferred" },
    { account_id: "acct_savings", account_name: "Savings" },
  ]},
  { item_id: "bank_amex", institution_name: "American Express", accounts: [
    { account_id: "acct_amex", account_name: "Gold Card" },
  ]},
  { item_id: "bank_schwab", institution_name: "Charles Schwab", accounts: [
    { account_id: "acct_brokerage", account_name: "Brokerage" },
    { account_id: "acct_checking_schwab", account_name: "Investor Checking" },
  ]},
  { item_id: "bank_bofa", institution_name: "Bank of America", accounts: [
    { account_id: "acct_bofa_checking", account_name: "Advantage Checking" },
  ]},
];

const cats = [
  ["INCOME", "INCOME_WAGES"],
  ["INCOME", "INCOME_OTHER_INCOME"],
  ["FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES"],
  ["FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT"],
  ["FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE"],
  ["TRANSPORTATION", "TRANSPORTATION_GAS"],
  ["TRANSPORTATION", "TRANSPORTATION_PUBLIC_TRANSPORTATION"],
  ["TRAVEL", "TRAVEL_FLIGHTS"],
  ["TRAVEL", "TRAVEL_LODGING"],
  ["GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES"],
  ["GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_DEPARTMENT_STORES"],
  ["ENTERTAINMENT", "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS"],
  ["ENTERTAINMENT", "ENTERTAINMENT_TV_AND_MUSIC"],
  ["RENT_AND_UTILITIES", "RENT_AND_UTILITIES_RENT"],
  ["RENT_AND_UTILITIES", "RENT_AND_UTILITIES_INTERNET_AND_CABLE"],
  ["LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"],
  ["TRANSFER_IN", "TRANSFER_IN_ACCOUNT_TRANSFER"],
  ["TRANSFER_OUT", "TRANSFER_OUT_ACCOUNT_TRANSFER"],
  ["PERSONAL_CARE", "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS"],
  ["MEDICAL", "MEDICAL_DENTAL_CARE"],
  ["HOME_IMPROVEMENT", "HOME_IMPROVEMENT_HARDWARE"],
];

const merchants = [
  ["Amazon", "https://logo.clearbit.com/amazon.com"],
  ["Whole Foods Market", "https://logo.clearbit.com/wholefoodsmarket.com"],
  ["Starbucks", "https://logo.clearbit.com/starbucks.com"],
  ["Shell", null],
  ["Trader Joe's", null],
  ["Spotify", "https://logo.clearbit.com/spotify.com"],
  ["Netflix", "https://logo.clearbit.com/netflix.com"],
  ["Uber", "https://logo.clearbit.com/uber.com"],
  ["Lyft", "https://logo.clearbit.com/lyft.com"],
  ["Delta Air Lines", null],
  ["Marriott", null],
  ["CVS Pharmacy", null],
  ["Target", "https://logo.clearbit.com/target.com"],
  ["Costco Wholesale", "https://logo.clearbit.com/costco.com"],
  ["Home Depot", "https://logo.clearbit.com/homedepot.com"],
  ["LA Fitness", null],
  ["DoorDash", "https://logo.clearbit.com/doordash.com"],
  ["Chipotle Mexican Grill", null],
  ["McDonald's", null],
  [null, null],
];

const nameTemplates = [
  "POS PURCHASE {m}",
  "ACH DEBIT {m}",
  "ONLINE PMT {m}",
  "RECURRING {m}",
  "MOBILE PMT {m}",
  "CHECKCARD {m}",
  "VISA DIRECT {m}",
];

function pick(arr) {
  return arr[Math.floor(rnd() * arr.length)];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoDay(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Spread dates from 2025-01-01 through 2026-06-28 */
function randomDate() {
  const start = new Date(2025, 0, 1).getTime();
  const end = new Date(2026, 5, 28).getTime();
  const t = start + rnd() * (end - start);
  const dt = new Date(t);
  const h = Math.floor(rnd() * 14) + 6;
  const min = Math.floor(rnd() * 60);
  return `${isoDay(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())}T${pad2(h)}:${pad2(min)}:00`;
}

const transactions = [];
let id = 0;

function pushTxn(base) {
  id += 1;
  transactions.push({
    transaction_id: `pf-gen-${id}`,
    iso_currency_code: "USD",
    ...base,
  });
}

/* Payroll-ish monthly */
for (let mo = 0; mo < 18; mo++) {
  const d = new Date(2025, 0, 1);
  d.setMonth(d.getMonth() + mo);
  if (d > new Date(2026, 5, 15)) break;
  const day = Math.min(28, 12 + (mo % 5));
  pushTxn({
    name: "DIR DEP PAYROLL",
    original_description: "ACME INDUSTRIES PAYROLL",
    merchant_name: null,
    amount: -(2800 + Math.floor(rnd() * 800)),
    item_id: "bank_chase",
    account_id: "acct_checking",
    institution_name: "Chase",
    account_name: "Total Checking",
    datetime: `${isoDay(d.getFullYear(), d.getMonth() + 1, day)}T09:00:00`,
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES" },
    bucket_1_tag_id: 1,
    meta_tag_ids: [],
  });
}

/* Many random spend / income lines */
const N = 420;
for (let i = 0; i < N; i++) {
  const bank = pick(banks);
  const acct = pick(bank.accounts);
  const cat = pick(cats);
  const [pri, det] = cat;
  const isIncome = pri === "INCOME";
  const baseAmt = isIncome ? -(20 + rnd() * 4000) : 2 + rnd() * 380;
  const amount = Math.round(baseAmt * 100) / 100;
  const [merch, logo] = pick(merchants);
  const tmpl = pick(nameTemplates).replace("{m}", merch || pick(["MERCHANT", "VENDOR", "STORE", "SERVICE"]));
  const cp = logo ? { counterparties: [{ logo_url: logo }] } : {};

  let bucket_1_tag_id = null;
  let bucket_2_tag_id = null;
  let meta_tag_ids = [];
  if (!isIncome) {
    if (pri === "FOOD_AND_DRINK") bucket_1_tag_id = rnd() < 0.55 ? 2 : null;
    else if (pri === "TRAVEL") bucket_2_tag_id = rnd() < 0.5 ? 3 : null;
    else if (pri === "RENT_AND_UTILITIES" && det.includes("RENT")) bucket_1_tag_id = rnd() < 0.85 ? 4 : null;
    if (rnd() < 0.12) meta_tag_ids.push(10);
    if (rnd() < 0.06) meta_tag_ids.push(11);
  } else if (rnd() < 0.15) {
    bucket_1_tag_id = 5;
  }

  pushTxn({
    name: tmpl.slice(0, 40),
    merchant_name: merch,
    amount,
    item_id: bank.item_id,
    account_id: acct.account_id,
    institution_name: bank.institution_name,
    account_name: acct.account_name,
    account_official_name: acct.account_official_name ?? null,
    datetime: randomDate(),
    personal_finance_category: { primary: pri, detailed: det },
    bucket_1_tag_id,
    bucket_2_tag_id,
    meta_tag_ids,
    ...cp,
  });
}

/* Netting pairs (add balanced legs) */
for (let g = 0; g < 28; g++) {
  const amt = 50 + Math.floor(rnd() * 900);
  const bank = banks[0];
  const d = randomDate();
  const gid = `net-gen-${g}`;
  pushTxn({
    name: "CARD PAYMENT",
    merchant_name: null,
    amount: amt,
    item_id: bank.item_id,
    account_id: "acct_cc",
    institution_name: bank.institution_name,
    account_name: "Sapphire Preferred",
    account_official_name: "Chase Sapphire Preferred",
    datetime: d,
    personal_finance_category: { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" },
    netting_group: gid,
  });
  pushTxn({
    name: "TRANSFER TO CARD",
    merchant_name: null,
    amount: -amt,
    item_id: bank.item_id,
    account_id: "acct_checking",
    institution_name: bank.institution_name,
    account_name: "Total Checking",
    datetime: d.replace(/T\d{2}:\d{2}/, `T${pad2(9 + (g % 3))}:${pad2(g % 60)}`),
    personal_finance_category: { primary: "TRANSFER_OUT", detailed: "TRANSFER_OUT_ACCOUNT_TRANSFER" },
    netting_group: gid,
  });
}

/* Account transfer markers (same group id) */
for (let g = 0; g < 12; g++) {
  const gid = `xfer-gen-${g}`;
  const amt = 100 + Math.floor(rnd() * 2000);
  const d = randomDate();
  pushTxn({
    name: "INTERNAL TRANSFER OUT",
    amount: amt,
    item_id: "bank_chase",
    account_id: "acct_checking",
    institution_name: "Chase",
    account_name: "Total Checking",
    datetime: d,
    personal_finance_category: { primary: "TRANSFER_OUT", detailed: "TRANSFER_OUT_ACCOUNT_TRANSFER" },
    account_transfer_group: gid,
  });
  pushTxn({
    name: "INTERNAL TRANSFER IN",
    amount: -amt,
    item_id: "bank_chase",
    account_id: "acct_savings",
    institution_name: "Chase",
    account_name: "Savings",
    datetime: d,
    personal_finance_category: { primary: "TRANSFER_IN", detailed: "TRANSFER_IN_ACCOUNT_TRANSFER" },
    account_transfer_group: gid,
  });
}

/* Original 6 curated rows (stable ids) at end — actually prepend by unshift is messy; merge: insert at start */
const curated = [
  {
    transaction_id: "pf-demo-1",
    name: "DIR DEP PAYROLL",
    original_description: "ACME CORP PAYROLL",
    merchant_name: null,
    amount: -3250,
    item_id: "bank_chase",
    account_id: "acct_checking",
    institution_name: "Chase",
    account_name: "Total Checking",
    iso_currency_code: "USD",
    datetime: "2026-06-01T08:00:00",
    personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES" },
    bucket_1_tag_id: 1,
    meta_tag_ids: [],
  },
  {
    transaction_id: "pf-demo-2",
    name: "WHOLEFDS MKT",
    merchant_name: "Whole Foods Market",
    amount: 87.42,
    item_id: "bank_chase",
    account_id: "acct_checking",
    institution_name: "Chase",
    account_name: "Total Checking",
    iso_currency_code: "USD",
    datetime: "2026-06-03T14:22:00",
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" },
    counterparties: [{ logo_url: "https://logo.clearbit.com/wholefoodsmarket.com" }],
    bucket_1_tag_id: 2,
    meta_tag_ids: [10],
  },
  {
    transaction_id: "pf-demo-3a",
    name: "CARD PAYMENT",
    merchant_name: null,
    amount: 450,
    item_id: "bank_chase",
    account_id: "acct_cc",
    institution_name: "Chase",
    account_name: "Sapphire",
    iso_currency_code: "USD",
    datetime: "2026-06-05T09:00:00",
    personal_finance_category: { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" },
    netting_group: "net-demo-1",
  },
  {
    transaction_id: "pf-demo-3b",
    name: "TRANSFER FROM CHECKING",
    merchant_name: null,
    amount: -450,
    item_id: "bank_chase",
    account_id: "acct_checking",
    institution_name: "Chase",
    account_name: "Total Checking",
    iso_currency_code: "USD",
    datetime: "2026-06-05T09:01:00",
    personal_finance_category: { primary: "TRANSFER_IN", detailed: "TRANSFER_IN_ACCOUNT_TRANSFER" },
    netting_group: "net-demo-1",
  },
  {
    transaction_id: "pf-demo-4",
    name: "UNITED AIRLINES",
    merchant_name: "United Airlines",
    amount: 312,
    item_id: "bank_amex",
    account_id: "acct_amex",
    institution_name: "American Express",
    account_name: "Gold Card",
    iso_currency_code: "USD",
    datetime: "2026-06-08T11:00:00",
    personal_finance_category: { primary: "TRAVEL", detailed: "TRAVEL_FLIGHTS" },
    bucket_2_tag_id: 3,
    meta_tag_ids: [],
  },
  {
    transaction_id: "pf-demo-5",
    name: "COFFEE SHOP",
    merchant_name: "Blue Bottle Coffee",
    amount: 6.5,
    item_id: "bank_chase",
    account_id: "acct_checking",
    institution_name: "Chase",
    account_name: "Total Checking",
    iso_currency_code: "USD",
    datetime: "2026-06-10T07:45:00",
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" },
  },
];

const allTx = [...curated, ...transactions];

fs.writeFileSync(out, JSON.stringify({ tags, transactions: allTx }, null, 2), "utf8");
console.error(`Wrote ${allTx.length} transactions to ${out}`);
