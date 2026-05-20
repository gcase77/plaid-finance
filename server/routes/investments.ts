import express from "express";
import { clearTransactionsCache } from "../lib/caches";
import { plaid } from "../lib/plaid";
import { logger } from "../logger";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();
const TXN_PAGE_SIZE = 500;

const dateOnly = (value: string | null | undefined) => value ? new Date(`${value}T00:00:00.000Z`) : null;
const dateTime = (value: string | null | undefined) => value ? new Date(value) : null;
const currencyCode = (row: any) => row.iso_currency_code ?? row.unofficial_currency_code ?? null;

const upsertSecurities = async (
  prisma: ServerRequest["prisma"],
  userId: string,
  itemId: string,
  securities: any[],
  accountBySecurity: Map<string, string>
) => {
  for (const security of securities) {
    const accountId = accountBySecurity.get(security.security_id);
    if (!accountId) continue;
    await prisma.securities.upsert({
      where: { id: security.security_id },
      create: {
        id: security.security_id,
        user_id: userId,
        item_id: itemId,
        account_id: accountId,
        institution_security_id: security.institution_security_id ?? null,
        institution_id: security.institution_id ?? null,
        proxy_security_id: security.proxy_security_id ?? null,
        name: security.name ?? null,
        ticker_symbol: security.ticker_symbol ?? null,
        is_cash_equivalent: security.is_cash_equivalent ?? null,
        type: security.type ?? null,
        subtype: security.subtype ?? null,
        close_price: security.close_price ?? null,
        close_price_as_of: dateOnly(security.close_price_as_of),
        update_datetime: dateTime(security.update_datetime),
        iso_currency_code: security.iso_currency_code ?? null,
        unofficial_currency_code: security.unofficial_currency_code ?? null,
        currency_code: currencyCode(security),
        market_identifier_code: security.market_identifier_code ?? null,
        sector: security.sector ?? null,
        industry: security.industry ?? null,
        option_contract: (security.option_contract as any) ?? null,
        fixed_income: (security.fixed_income as any) ?? null,
        raw_payload: security
      },
      update: {
        user_id: userId,
        item_id: itemId,
        account_id: accountId,
        institution_security_id: security.institution_security_id ?? null,
        institution_id: security.institution_id ?? null,
        proxy_security_id: security.proxy_security_id ?? null,
        name: security.name ?? null,
        ticker_symbol: security.ticker_symbol ?? null,
        is_cash_equivalent: security.is_cash_equivalent ?? null,
        type: security.type ?? null,
        subtype: security.subtype ?? null,
        close_price: security.close_price ?? null,
        close_price_as_of: dateOnly(security.close_price_as_of),
        update_datetime: dateTime(security.update_datetime),
        iso_currency_code: security.iso_currency_code ?? null,
        unofficial_currency_code: security.unofficial_currency_code ?? null,
        currency_code: currencyCode(security),
        market_identifier_code: security.market_identifier_code ?? null,
        sector: security.sector ?? null,
        industry: security.industry ?? null,
        option_contract: (security.option_contract as any) ?? null,
        fixed_income: (security.fixed_income as any) ?? null,
        raw_payload: security
      }
    });
  }
};

router.post("/investments/holdings/sync", async (req, res) => {
  const { prisma, user } = req as unknown as ServerRequest;
  try {
    const items = await prisma.items.findMany({
      where: { user_id: user.id },
      select: { id: true, access_token: true }
    });
    let holdingsCount = 0;
    let securitiesCount = 0;

    for (const item of items) {
      if (!item.access_token) continue;
      const response = await plaid.investmentsHoldingsGet({ access_token: item.access_token } as any);
      const { holdings = [], securities = [] } = response.data as any;
      const accountBySecurity = new Map<string, string>();
      for (const holding of holdings) accountBySecurity.set(holding.security_id, holding.account_id);

      await prisma.$transaction(async (tx) => {
        await upsertSecurities(tx as any, user.id, item.id, securities, accountBySecurity);
        for (const holding of holdings) {
          const institutionPriceDate = dateTime(holding.institution_price_datetime) ?? dateOnly(holding.institution_price_as_of);
          if (!institutionPriceDate) continue;
          await tx.investment_holdings.upsert({
            where: { account_id_security_id: { account_id: holding.account_id, security_id: holding.security_id } },
            create: {
              account_id: holding.account_id,
              security_id: holding.security_id,
              user_id: user.id,
              item_id: item.id,
              institution_price: holding.institution_price,
              institution_price_as_of: dateOnly(holding.institution_price_as_of),
              institution_price_datetime: dateTime(holding.institution_price_datetime),
              institution_price_date: institutionPriceDate,
              institution_value: holding.institution_value,
              cost_basis: holding.cost_basis ?? null,
              quantity: holding.quantity,
              iso_currency_code: holding.iso_currency_code ?? null,
              unofficial_currency_code: holding.unofficial_currency_code ?? null,
              currency_code: currencyCode(holding),
              vested_quantity: holding.vested_quantity ?? null,
              vested_value: holding.vested_value ?? null,
              raw_payload: holding
            },
            update: {
              user_id: user.id,
              item_id: item.id,
              institution_price: holding.institution_price,
              institution_price_as_of: dateOnly(holding.institution_price_as_of),
              institution_price_datetime: dateTime(holding.institution_price_datetime),
              institution_price_date: institutionPriceDate,
              institution_value: holding.institution_value,
              cost_basis: holding.cost_basis ?? null,
              quantity: holding.quantity,
              iso_currency_code: holding.iso_currency_code ?? null,
              unofficial_currency_code: holding.unofficial_currency_code ?? null,
              currency_code: currencyCode(holding),
              vested_quantity: holding.vested_quantity ?? null,
              vested_value: holding.vested_value ?? null,
              raw_payload: holding
            }
          });
        }
      });

      holdingsCount += holdings.length;
      securitiesCount += securities.length;
      await logger.to_db("INFO", user.id, "INVESTMENT HOLDINGS SYNC", { itemId: item.id, holdings: holdings.length, securities: securities.length }, response.data as any);
    }

    res.json({ success: true, holdings: holdingsCount, securities: securitiesCount });
  } catch (e: any) {
    logger.log("error", "sync investment holdings", { err: e, userId: user.id });
    res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

router.post("/investments/transactions/sync", async (req, res) => {
  const { prisma, user } = req as unknown as ServerRequest;
  const startDate = typeof req.body?.startDate === "string" ? req.body.startDate : "2000-01-01";
  const endDate = typeof req.body?.endDate === "string" ? req.body.endDate : new Date().toISOString().slice(0, 10);

  try {
    const items = await prisma.items.findMany({
      where: { user_id: user.id },
      select: { id: true, access_token: true }
    });
    let transactionsCount = 0;
    let securitiesCount = 0;

    for (const item of items) {
      if (!item.access_token) continue;
      let offset = 0;
      let total = 0;
      do {
        const request = {
          access_token: item.access_token,
          start_date: startDate,
          end_date: endDate,
          options: { count: TXN_PAGE_SIZE, offset }
        };
        const response = await plaid.investmentsTransactionsGet(request as any);
        const { investment_transactions: transactions = [], securities = [], total_investment_transactions = 0 } = response.data as any;
        total = total_investment_transactions;
        const accountBySecurity = new Map<string, string>();
        for (const txn of transactions) if (txn.security_id) accountBySecurity.set(txn.security_id, txn.account_id);

        await prisma.$transaction(async (tx) => {
          await upsertSecurities(tx as any, user.id, item.id, securities, accountBySecurity);
          for (const txn of transactions) {
            const postedDate = dateOnly(txn.date);
            const resolvedDatetime = dateTime(txn.datetime) ?? postedDate;
            if (!postedDate || !resolvedDatetime) continue;
            await tx.investment_transactions.upsert({
              where: { id: txn.investment_transaction_id },
              create: {
                id: txn.investment_transaction_id,
                user_id: user.id,
                item_id: item.id,
                account_id: txn.account_id,
                security_id: txn.security_id ?? null,
                date: postedDate,
                plaid_datetime: dateTime(txn.datetime),
                datetime: resolvedDatetime,
                name: txn.name,
                quantity: txn.quantity,
                amount: txn.amount,
                price: txn.price,
                fees: txn.fees ?? null,
                type: txn.type,
                subtype: txn.subtype,
                iso_currency_code: txn.iso_currency_code ?? null,
                unofficial_currency_code: txn.unofficial_currency_code ?? null,
                currency_code: currencyCode(txn),
                raw_payload: txn
              },
              update: {
                user_id: user.id,
                item_id: item.id,
                account_id: txn.account_id,
                security_id: txn.security_id ?? null,
                date: postedDate,
                plaid_datetime: dateTime(txn.datetime),
                datetime: resolvedDatetime,
                name: txn.name,
                quantity: txn.quantity,
                amount: txn.amount,
                price: txn.price,
                fees: txn.fees ?? null,
                type: txn.type,
                subtype: txn.subtype,
                iso_currency_code: txn.iso_currency_code ?? null,
                unofficial_currency_code: txn.unofficial_currency_code ?? null,
                currency_code: currencyCode(txn),
                raw_payload: txn
              }
            });
          }
        });

        transactionsCount += transactions.length;
        securitiesCount += securities.length;
        offset += transactions.length;
        await logger.to_db("INFO", user.id, "INVESTMENT TRANSACTIONS SYNC", { itemId: item.id, transactions: transactions.length, securities: securities.length, offset, total }, response.data as any);
      } while (offset < total);
    }

    clearTransactionsCache(user.id);
    res.json({ success: true, transactions: transactionsCount, securities: securitiesCount });
  } catch (e: any) {
    logger.log("error", "sync investment transactions", { err: e, userId: user.id });
    res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

router.get("/investments", async (req, res) => {
  const { prisma, user } = req as unknown as ServerRequest;
  try {
    const [holdings, transactions, securities] = await Promise.all([
      prisma.investment_holdings.findMany({
        where: { user_id: user.id },
        orderBy: { institution_value: "desc" },
        include: { accounts: { select: { name: true, official_name: true } }, items: { select: { institution_name: true } }, securities: true }
      }),
      prisma.investment_transactions.findMany({
        where: { user_id: user.id },
        orderBy: { datetime: "desc" },
        take: 500,
        include: { accounts: { select: { name: true, official_name: true } }, items: { select: { institution_name: true } }, securities: true }
      }),
      prisma.securities.findMany({
        where: { user_id: user.id },
        orderBy: [{ ticker_symbol: "asc" }, { name: "asc" }]
      })
    ]);
    res.json({ holdings, transactions, securities });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
