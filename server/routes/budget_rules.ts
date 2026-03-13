import express from "express";
import { BudgetRuleType, CalendarWindow, RolloverOption } from "../../generated/prisma/client";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

type Period = {
  start_date: string;
  end_date: string;
};

type BudgetRuleCacheEntry = Period & {
  associated_spending: number;
  associated_income: number | null;
  rollover: number;
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

export const buildBudgetRuleCache = (
  startDateStr: string,
  window: CalendarWindow,
  ruleType: BudgetRuleType
): BudgetRuleCacheEntry[] =>
  buildBudgetRulePeriods(startDateStr, window).map((period) => ({
    ...period,
    associated_spending: 0,
    associated_income: ruleType === BudgetRuleType.flat_rate ? null : 0,
    rollover: 0
  }));

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
    const { prisma } = req as unknown as ServerRequest;
    const { tag_id, name, start_date, type, flat_amount, percent, calendar_window, rollover_options } = req.body ?? {};
    if (!tag_id || !name || !start_date || !type || !calendar_window || !rollover_options) {
      return res.status(400).json({ error: "tag_id, name, start_date, type, calendar_window, and rollover_options are required" });
    }
    if (!validTypes.has(type)) return res.status(400).json({ error: "Invalid budget rule type" });
    if (!validWindows.has(calendar_window)) return res.status(400).json({ error: "Invalid calendar window" });
    if (!validRollover.has(rollover_options)) return res.status(400).json({ error: "Invalid rollover option" });
    const startDate = parseISODate(start_date);
    if (!startDate) return res.status(400).json({ error: "Invalid start_date" });
    if (!Number.isInteger(Number(tag_id))) return res.status(400).json({ error: "Invalid tag_id" });

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
    const cache = buildBudgetRuleCache(startDate.raw, windowType, ruleType);
    const created = await prisma.budget_rules.create({
      data: {
        tag_id: Number(tag_id),
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
    const { prisma } = req as unknown as ServerRequest;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid budget rule id" });
    const existing = await prisma.budget_rules.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Budget rule not found" });

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
      || req.body?.cache == null;
    const nextCache = req.body?.cache ?? (shouldRebuildCache ? buildBudgetRuleCache(parsedStart.raw, nextWindow, nextType) : existing.cache);

    const updated = await prisma.budget_rules.update({
      where: { id },
      data: {
        ...(req.body?.tag_id != null ? { tag_id: Number(req.body.tag_id) } : {}),
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

