import express from "express";
import { BudgetRuleType, CalendarWindow, RolloverOption, TagType } from "../../generated/prisma/client";
import type { BudgetRuleSourceType } from "../../generated/prisma/client";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

type Period = {
  start_date: string;
  end_date: string;
};

type BudgetRuleCacheEntry = Period & {
  base_budget: number | null;
  effective_budget: number | null;
  balance: number | null;
  associated_spend: number;
  associated_income: number;
};

const toISODate = (d: Date) =>
  d.toISOString().slice(0, 10);

const startOfWeek = (d: Date) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 (Sun) - 6 (Sat)
  date.setUTCDate(date.getUTCDate() - day);
  return date;
};

const endOfWeek = (d: Date) => {
  const start = startOfWeek(d);
  start.setUTCDate(start.getUTCDate() + 6);
  return start;
};

const startOfMonth = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

const endOfMonth = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));

export const buildBudgetRulePeriods = (startDateStr: string, window: CalendarWindow): Period[] => {
  const anchor = new Date(`${startDateStr}T00:00:00.000Z`);
  if (Number.isNaN(anchor.valueOf())) return [];

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  let currentStart: Date;
  let currentEnd: Date;

  if (window === "week") {
    const weekStart = startOfWeek(anchor);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7); // one full week before
    currentStart = weekStart;
    currentEnd = endOfWeek(currentStart);
  } else {
    const monthStart = startOfMonth(anchor);
    monthStart.setUTCMonth(monthStart.getUTCMonth() - 1); // one full month before
    currentStart = monthStart;
    currentEnd = endOfMonth(currentStart);
  }

  const periods: Period[] = [];

  while (currentStart <= todayUTC) {
    periods.push({
      start_date: toISODate(currentStart),
      end_date: toISODate(currentEnd)
    });

    if (currentEnd >= todayUTC) break;

    if (window === "week") {
      currentStart = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth(), currentStart.getUTCDate() + 7));
      currentEnd = endOfWeek(currentStart);
    } else {
      currentStart = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth() + 1, 1));
      currentEnd = endOfMonth(currentStart);
    }
  }

  return periods;
};

const BUDGET_RULE_TAG_TYPES = new Set<TagType>([TagType.spending_bucket_1, TagType.spending_bucket_2, TagType.meta]);

const getTxnDate = (txn: { datetime: Date | null; authorized_datetime: Date | null }) =>
  txn.datetime ?? txn.authorized_datetime;

const isWithinRange = (d: Date, start: Date, end: Date) => d >= start && d <= end;

const resolvePeriodIndex = (isoDate: string, periods: Period[]) => {
  for (let i = 0; i < periods.length; i += 1) {
    if (isoDate >= periods[i].start_date && isoDate <= periods[i].end_date) return i;
  }
  return -1;
};

const clamp = (value: number, lower: number, upper: number) =>
  Math.min(Math.max(value, lower), upper);

const getBalanceBounds = (rolloverOption: RolloverOption) => {
  switch (rolloverOption) {
    case RolloverOption.none:
      return { lower: 0, upper: 0 };
    case RolloverOption.surplus:
      return { lower: 0, upper: Number.POSITIVE_INFINITY };
    case RolloverOption.deficit:
      return { lower: Number.NEGATIVE_INFINITY, upper: 0 };
    case RolloverOption.both:
    default:
      return { lower: Number.NEGATIVE_INFINITY, upper: Number.POSITIVE_INFINITY };
  }
};

const ensureBudgetRuleTag = async (prisma: ServerRequest["prisma"], userId: string, tagId: number) => {
  const tag = await prisma.tags.findFirst({
    where: { id: tagId, user_id: userId },
    select: { type: true }
  });
  if (!tag) return { ok: false as const, status: 404, error: "Tag not found" };
  if (!BUDGET_RULE_TAG_TYPES.has(tag.type)) {
    return { ok: false as const, status: 422, error: "Budget rules can only be created for spending or meta tags" };
  }
  return { ok: true as const };
};

const normalizeDetectedCategory = (raw: unknown): string | null => {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return normalized || null;
};

const getTxnDetectedCategory = (rawCategory: unknown): string | null => {
  if (!rawCategory || typeof rawCategory !== "object") return null;
  const category = rawCategory as { primary?: unknown; detailed?: unknown };
  return normalizeDetectedCategory(category.detailed ?? category.primary);
};

type RuleSource =
  | { rule_source_type: "tag"; tag_id: number; detected_category: null }
  | { rule_source_type: "detected_category"; tag_id: null; detected_category: string };

export const buildBudgetRuleCache = async (
  prisma: ServerRequest["prisma"],
  userId: string,
  source: RuleSource,
  startDateStr: string,
  window: CalendarWindow,
  ruleType: BudgetRuleType,
  rolloverOption: RolloverOption,
  flatAmount: number | null,
  percentAmount: number | null
): Promise<BudgetRuleCacheEntry[]> => {
  const periods = buildBudgetRulePeriods(startDateStr, window);
  if (!periods.length) return [];
  const rangeStart = new Date(`${periods[0].start_date}T00:00:00.000Z`);
  const rangeEnd = new Date(`${periods[periods.length - 1].end_date}T23:59:59.999Z`);

  const rows = await prisma.transactions.findMany({
    where: {
      user_id: userId,
      is_removed: false,
      OR: [
        { datetime: { gte: rangeStart, lte: rangeEnd } },
        { authorized_datetime: { gte: rangeStart, lte: rangeEnd } }
      ]
    },
    select: {
      amount: true,
      datetime: true,
      authorized_datetime: true,
      personal_finance_category: true,
      transaction_meta: {
        select: {
          account_transfer_group: true,
          bucket_1_tag_id: true,
          bucket_2_tag_id: true,
          meta_tags: { select: { tag_id: true } }
        }
      }
    }
  });

  const cache = periods.map<BudgetRuleCacheEntry>((period) => ({
    ...period,
    base_budget: null,
    effective_budget: null,
    balance: null,
    associated_spend: 0,
    associated_income: 0
  }));

  for (const row of rows) {
    const amount = row.amount ?? 0;
    const date = getTxnDate(row);
    if (!date || !isWithinRange(date, rangeStart, rangeEnd)) continue;
    const idx = resolvePeriodIndex(toISODate(date), periods);
    if (idx < 0) continue;
    if (row.transaction_meta?.account_transfer_group != null) continue;

    if (amount < 0) {
      cache[idx].associated_income += Math.abs(amount);
    }

    const matchesRule = source.rule_source_type === "tag"
      ? row.transaction_meta?.bucket_1_tag_id === source.tag_id
        || row.transaction_meta?.bucket_2_tag_id === source.tag_id
        || (row.transaction_meta?.meta_tags?.some((link) => link.tag_id === source.tag_id) ?? false)
      : getTxnDetectedCategory(row.personal_finance_category) === source.detected_category;
    if (matchesRule && amount > 0) {
      cache[idx].associated_spend += amount;
    }
  }

  // Period 0 is reference-only for budget math: budgets/balance stay null.

  const { lower, upper } = getBalanceBounds(rolloverOption);
  let previousBalance = 0;
  for (let i = 1; i < cache.length; i += 1) {
    const baseBudget = ruleType === BudgetRuleType.flat_rate
      ? (flatAmount ?? 0)
      : (((percentAmount ?? 0) / 100) * cache[i - 1].associated_income);
    const effectiveBudget = baseBudget + previousBalance;
    const rawBalance = effectiveBudget - cache[i].associated_spend;
    const balance = clamp(rawBalance, lower, upper);

    cache[i].base_budget = baseBudget;
    cache[i].effective_budget = effectiveBudget;
    cache[i].balance = balance;
    previousBalance = balance;
  }

  return cache;
};

const validTypes = new Set(Object.values(BudgetRuleType));
const validWindows = new Set(Object.values(CalendarWindow));
const validRollover = new Set(Object.values(RolloverOption));

const parseISODate = (raw: unknown) => {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return null;
  return { raw: value, date };
};

router.get("/budget_rules", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const rows = await prisma.budget_rules.findMany({
      where: { user_id: user.id },
      orderBy: { id: "asc" }
    });
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/budget_rules", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const { rule_source_type, tag_id, detected_category, name, start_date, type, flat_amount, percent, calendar_window, rollover_options } = req.body ?? {};
    if (!rule_source_type || !name || !start_date || !type || !calendar_window || !rollover_options) {
      return res.status(400).json({ error: "rule_source_type, name, start_date, type, calendar_window, and rollover_options are required" });
    }
    if (rule_source_type !== "tag" && rule_source_type !== "detected_category") {
      return res.status(400).json({ error: "Invalid rule_source_type" });
    }
    if (!validTypes.has(type)) return res.status(400).json({ error: "Invalid budget rule type" });
    if (!validWindows.has(calendar_window)) return res.status(400).json({ error: "Invalid calendar window" });
    if (!validRollover.has(rollover_options)) return res.status(400).json({ error: "Invalid rollover option" });
    const startDate = parseISODate(start_date);
    if (!startDate) return res.status(400).json({ error: "Invalid start_date" });
    const normalizedDetectedCategory = normalizeDetectedCategory(detected_category);

    let source: RuleSource;
    if (rule_source_type === "tag") {
      if (normalizedDetectedCategory) return res.status(400).json({ error: "detected_category must be null when rule_source_type is tag" });
      if (!Number.isInteger(Number(tag_id))) return res.status(400).json({ error: "Invalid tag_id" });
      const numericTagId = Number(tag_id);
      const tagCheck = await ensureBudgetRuleTag(prisma, user.id, numericTagId);
      if (!tagCheck.ok) return res.status(tagCheck.status).json({ error: tagCheck.error });
      source = { rule_source_type: "tag", tag_id: numericTagId, detected_category: null };
    } else {
      if (tag_id != null) return res.status(400).json({ error: "tag_id must be null when rule_source_type is detected_category" });
      if (!normalizedDetectedCategory) return res.status(400).json({ error: "detected_category is required when rule_source_type is detected_category" });
      source = {
        rule_source_type: "detected_category",
        tag_id: null,
        detected_category: normalizedDetectedCategory
      };
    }

    const parsedFlat = flat_amount == null ? null : Number(flat_amount);
    const parsedPercent = percent == null ? null : Number(percent);
    if (type === BudgetRuleType.flat_rate && (parsedFlat == null || Number.isNaN(parsedFlat) || parsedFlat < 0)) {
      return res.status(400).json({ error: "flat_amount must be a number >= 0 for flat_rate rules" });
    }
    if (type === BudgetRuleType.percent_of_income && (parsedPercent == null || Number.isNaN(parsedPercent) || parsedPercent < 0)) {
      return res.status(400).json({ error: "percent must be a number >= 0 for percent_of_income rules" });
    }

    const ruleType = type as BudgetRuleType;
    const windowType = calendar_window as CalendarWindow;
    const rolloverType = rollover_options as RolloverOption;
    const cache = await buildBudgetRuleCache(
      prisma,
      user.id,
      source,
      startDate.raw,
      windowType,
      ruleType,
      rolloverType,
      ruleType === BudgetRuleType.flat_rate ? parsedFlat : null,
      ruleType === BudgetRuleType.percent_of_income ? parsedPercent : null
    );
    const created = await prisma.budget_rules.create({
      data: {
        user_id: user.id,
        rule_source_type: source.rule_source_type,
        tag_id: source.tag_id,
        detected_category: source.detected_category,
        name: String(name),
        start_date: startDate.date,
        type: ruleType,
        flat_amount: ruleType === BudgetRuleType.flat_rate ? parsedFlat : null,
        percent: ruleType === BudgetRuleType.percent_of_income ? parsedPercent : null,
        calendar_window: windowType,
        rollover_options: rolloverType,
        cache
      } as any
    });

    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/budget_rules/:id", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid budget rule id" });
    const existing = await prisma.budget_rules.findFirst({ where: { id, user_id: user.id } });
    if (!existing) return res.status(404).json({ error: "Budget rule not found" });
    if (req.body?.rule_source_type != null || req.body?.tag_id != null || req.body?.detected_category != null) {
      return res.status(400).json({ error: "rule source cannot be changed after creation" });
    }

    const nextType = req.body?.type ?? existing.type;
    const nextWindow = req.body?.calendar_window ?? existing.calendar_window;
    const nextStartRaw = req.body?.start_date ?? toISODate(existing.start_date);
    const parsedStart = parseISODate(nextStartRaw);
    if (!parsedStart) return res.status(400).json({ error: "Invalid start_date" });
    if (!validTypes.has(nextType)) return res.status(400).json({ error: "Invalid budget rule type" });
    if (!validWindows.has(nextWindow)) return res.status(400).json({ error: "Invalid calendar window" });
    if (req.body?.rollover_options && !validRollover.has(req.body.rollover_options)) {
      return res.status(400).json({ error: "Invalid rollover option" });
    }
    let existingSource: RuleSource;
    if (existing.rule_source_type === "tag") {
      if (!Number.isInteger(existing.tag_id)) return res.status(500).json({ error: "Invalid existing rule source" });
      existingSource = { rule_source_type: "tag", tag_id: existing.tag_id, detected_category: null };
    } else {
      const normalizedExistingDetectedCategory = normalizeDetectedCategory(existing.detected_category);
      if (!normalizedExistingDetectedCategory) return res.status(500).json({ error: "Invalid existing rule source" });
      existingSource = {
        rule_source_type: "detected_category",
        tag_id: null,
        detected_category: normalizedExistingDetectedCategory
      };
    }

    const rawFlat = req.body?.flat_amount ?? existing.flat_amount;
    const rawPercent = req.body?.percent ?? existing.percent;
    const nextFlat = rawFlat == null ? null : Number(rawFlat);
    const nextPercent = rawPercent == null ? null : Number(rawPercent);
    if (nextType === BudgetRuleType.flat_rate && (nextFlat == null || Number.isNaN(nextFlat) || nextFlat < 0)) {
      return res.status(400).json({ error: "flat_amount must be a number >= 0 for flat_rate rules" });
    }
    if (nextType === BudgetRuleType.percent_of_income && (nextPercent == null || Number.isNaN(nextPercent) || nextPercent < 0)) {
      return res.status(400).json({ error: "percent must be a number >= 0 for percent_of_income rules" });
    }

    const shouldRebuildCache = req.body?.start_date != null
      || req.body?.calendar_window != null
      || req.body?.type != null
      || req.body?.flat_amount != null
      || req.body?.percent != null
      || req.body?.rollover_options != null
      || req.body?.cache == null;
    const nextCache = req.body?.cache ?? (shouldRebuildCache
      ? await buildBudgetRuleCache(
        prisma,
        user.id,
        existingSource,
        parsedStart.raw,
        nextWindow,
        nextType,
        req.body?.rollover_options ?? existing.rollover_options,
        nextType === BudgetRuleType.flat_rate ? nextFlat : null,
        nextType === BudgetRuleType.percent_of_income ? nextPercent : null
      )
      : existing.cache);

    const updated = await prisma.budget_rules.update({
      where: { id: existing.id },
      data: {
        ...(req.body?.name != null ? { name: String(req.body.name) } : {}),
        ...(req.body?.start_date != null ? { start_date: parsedStart.date } : {}),
        ...(req.body?.type != null ? { type: nextType } : {}),
        ...(req.body?.calendar_window != null ? { calendar_window: nextWindow } : {}),
        ...(req.body?.rollover_options != null ? { rollover_options: req.body.rollover_options } : {}),
        flat_amount: nextType === BudgetRuleType.flat_rate ? nextFlat : null,
        percent: nextType === BudgetRuleType.percent_of_income ? nextPercent : null,
        cache: nextCache
      }
    });

    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Budget rule not found" });
    res.status(500).json({ error: e.message });
  }
});

router.delete("/budget_rules/:id", async (req, res) => {
  try {
    const { prisma } = req as unknown as ServerRequest;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid budget rule id" });
    await prisma.budget_rules.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Budget rule not found" });
    res.status(500).json({ error: e.message });
  }
});

export default router;

