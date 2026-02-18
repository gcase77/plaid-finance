import express from "express";
import type { PrismaClient } from "../../generated/prisma/client";
import { BudgetRuleType, CalendarWindow, RolloverOption } from "../../generated/prisma/client";

type Params = { prisma: PrismaClient };

// --- Period helpers (ISO: week starts Monday) ---

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfISOWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return out;
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function addWeeks(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 7 * 24 * 60 * 60 * 1000);
}

interface Period { start: Date; end: Date }

function generatePeriods(startDate: Date, window: CalendarWindow, now: Date): Period[] {
  const periods: Period[] = [];
  let cur = window === "month" ? startOfMonth(startDate) : startOfISOWeek(startDate);
  const currentPeriodStart = window === "month" ? startOfMonth(now) : startOfISOWeek(now);

  while (cur <= currentPeriodStart) {
    const next = window === "month" ? addMonths(cur, 1) : addWeeks(cur, 1);
    periods.push({ start: cur, end: next });
    cur = next;
  }
  return periods;
}

// --- Income query helper ---

async function getPeriodIncome(prisma: PrismaClient, userId: string, start: Date, end: Date): Promise<number> {
  const rows = await prisma.transactions.findMany({
    where: {
      user_id: userId,
      amount: { lt: 0 },
      is_removed: false,
      datetime: { gte: start, lt: end },
      NOT: { transaction_meta: { account_transfer_group: { not: null } } }
    },
    select: { amount: true }
  });
  return rows.reduce((sum, r) => sum + Math.abs(r.amount ?? 0), 0);
}

// --- Spending query helper ---

async function getPeriodSpending(
  prisma: PrismaClient,
  userId: string,
  tagId: number,
  isBucket2: boolean,
  start: Date,
  end: Date
): Promise<number> {
  const where = isBucket2
    ? { bucket_2_tag_id: tagId }
    : { bucket_1_tag_id: tagId };

  const rows = await prisma.transactions.findMany({
    where: {
      user_id: userId,
      amount: { gt: 0 },
      is_removed: false,
      datetime: { gte: start, lt: end },
      transaction_meta: { ...where, account_transfer_group: null }
    },
    select: { amount: true }
  });
  return rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
}

// --- Evaluate a rule against all periods up to now ---

async function evaluateRule(
  prisma: PrismaClient,
  rule: {
    id: number;
    user_id: string;
    tag_id: number;
    start_date: Date;
    type: BudgetRuleType;
    flat_amount: number | null;
    percent: number | null;
    calendar_window: CalendarWindow;
    rollover_options: RolloverOption;
    tag: { type: string };
  }
) {
  const now = new Date();
  const isBucket2 = rule.tag.type === "spending_bucket_2";
  const periods = generatePeriods(rule.start_date, rule.calendar_window, now);

  let carry = 0;
  const periodHistory: { start: string; end: string; budget: number; spending: number; delta: number; carry_after: number; income?: number }[] = [];

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const isCurrentPeriod = i === periods.length - 1;

    let budget = 0;
    let income: number | undefined;
    if (rule.type === "flat_rate") {
      budget = rule.flat_amount ?? 0;
    } else {
      // Use previous period's income, or current period as fallback for first period
      const incomePeriod = i > 0 ? periods[i - 1] : period;
      income = await getPeriodIncome(prisma, rule.user_id, incomePeriod.start, incomePeriod.end);
      budget = income * (rule.percent ?? 0);
    }

    const spending = await getPeriodSpending(prisma, rule.user_id, rule.tag_id, isBucket2, period.start, period.end);
    const effectiveBudget = budget + carry;
    const delta = effectiveBudget - spending;

    if (!isCurrentPeriod) {
      if (rule.rollover_options === "none") carry = 0;
      else if (rule.rollover_options === "surplus") carry = Math.max(0, delta);
      else if (rule.rollover_options === "deficit") carry = Math.min(0, delta);
      else carry = delta;
    }

    periodHistory.push({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      budget,
      spending,
      delta,
      carry_after: carry,
      ...(income !== undefined ? { income } : {})
    });
  }

  const current = periodHistory[periodHistory.length - 1];
  return {
    rule_id: rule.id,
    carry,
    current_period: {
      start: current?.start ?? null,
      end: current?.end ?? null,
      base_budget: current?.budget ?? 0,
      effective_budget: (current?.budget ?? 0) + carry,
      spending: current?.spending ?? 0,
      remaining: (current?.budget ?? 0) + carry - (current?.spending ?? 0)
    },
    period_history: periodHistory
  };
}

// --- Route factory ---

export default ({ prisma }: Params) => {
  const router = express.Router();

  const VALID_SPENDING_TYPES = new Set(["spending_bucket_1", "spending_bucket_2"]);

  router.get("/", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const rules = await prisma.budget_rules.findMany({
        where: { user_id: userId },
        include: { tag: true },
        orderBy: { id: "asc" }
      });
      const statuses = await Promise.all(rules.map((r) => evaluateRule(prisma, r)));
      res.json({ rules, statuses });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { tag_id, type, flat_amount, percent, calendar_window, rollover_options, start_date, use_earliest_transaction, name } = req.body;

      if (!tag_id || !type || !calendar_window || !rollover_options || !name?.trim()) {
        return res.status(400).json({ error: "tag_id, name, type, calendar_window, rollover_options are required" });
      }
      if (!Object.values(BudgetRuleType).includes(type)) return res.status(400).json({ error: "invalid type" });
      if (!Object.values(CalendarWindow).includes(calendar_window)) return res.status(400).json({ error: "invalid calendar_window" });
      if (!Object.values(RolloverOption).includes(rollover_options)) return res.status(400).json({ error: "invalid rollover_options" });

      const tag = await prisma.tags.findFirst({ where: { id: Number(tag_id), user_id: userId } });
      if (!tag) return res.status(404).json({ error: "Tag not found" });
      if (!VALID_SPENDING_TYPES.has(tag.type)) return res.status(400).json({ error: "Tag must be a spending bucket" });

      if (type === "flat_rate" && (flat_amount == null || isNaN(Number(flat_amount)))) {
        return res.status(400).json({ error: "flat_amount is required for flat_rate rules" });
      }
      if (type === "percent_of_income" && (percent == null || isNaN(Number(percent)))) {
        return res.status(400).json({ error: "percent is required for percent_of_income rules" });
      }

      let resolvedStartDate: Date;
      if (use_earliest_transaction) {
        const isBucket2 = tag.type === "spending_bucket_2";
        const where = isBucket2 ? { bucket_2_tag_id: Number(tag_id) } : { bucket_1_tag_id: Number(tag_id) };
        const earliest = await prisma.transactions.findFirst({
          where: { user_id: userId, is_removed: false, transaction_meta: { ...where } },
          orderBy: { datetime: "asc" },
          select: { datetime: true }
        });
        resolvedStartDate = earliest?.datetime ?? new Date();
      } else {
        if (!start_date) return res.status(400).json({ error: "start_date is required" });
        resolvedStartDate = new Date(start_date);
        if (isNaN(resolvedStartDate.getTime())) return res.status(400).json({ error: "invalid start_date" });
      }

      const rule = await prisma.budget_rules.create({
        data: {
          user_id: userId,
          tag_id: Number(tag_id),
          name: String(name).trim(),
          start_date: resolvedStartDate,
          type,
          flat_amount: type === "flat_rate" ? Number(flat_amount) : null,
          percent: type === "percent_of_income" ? Number(percent) : null,
          calendar_window,
          rollover_options
        },
        include: { tag: true }
      });
      res.status(201).json(rule);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const id = Number(req.params.id);
      const existing = await prisma.budget_rules.findFirst({ where: { id, user_id: userId } });
      if (!existing) return res.status(404).json({ error: "Rule not found" });

      const { flat_amount, percent, rollover_options, start_date, name } = req.body;
      const data: Record<string, unknown> = {};
      if (name?.trim()) data.name = String(name).trim();
      if (flat_amount != null) data.flat_amount = Number(flat_amount);
      if (percent != null) data.percent = Number(percent);
      if (rollover_options && Object.values(RolloverOption).includes(rollover_options)) data.rollover_options = rollover_options;
      if (start_date) {
        const d = new Date(start_date);
        if (!isNaN(d.getTime())) data.start_date = d;
      }

      const rule = await prisma.budget_rules.update({ where: { id }, data, include: { tag: true } });
      res.json(rule);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const id = Number(req.params.id);
      const existing = await prisma.budget_rules.findFirst({ where: { id, user_id: userId } });
      if (!existing) return res.status(404).json({ error: "Rule not found" });
      await prisma.budget_rules.delete({ where: { id } });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
