import express from "express";
import type { PlaidApi } from "plaid";
import type { Logger } from "../logger";
import type { PrismaClient } from "../../generated/prisma/client";

type Params = { plaid: PlaidApi; prisma: PrismaClient; logger: Logger };

export default ({ plaid, prisma, logger }: Params) => {
  const router = express.Router();

  router.post("/link-token", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const requestedDays = Number(req.body?.daysRequested);
      const daysRequested = Number.isFinite(requestedDays)
        ? Math.min(730, Math.max(1, Math.floor(requestedDays)))
        : 730;
      const linkTokenRequest: any = {
        user: { client_user_id: userId },
        products: ["transactions"],
        client_name: "Plaid App",
        language: "en",
        country_codes: ["US"],
        transactions: { days_requested: daysRequested }
      };
      if (process.env.PLAID_REDIRECT_URI) linkTokenRequest.redirect_uri = process.env.PLAID_REDIRECT_URI;
      const { data } = await plaid.linkTokenCreate(linkTokenRequest);
      logger.log("info", "plaid linkTokenCreate", { input: linkTokenRequest, output: data });
      res.json(data);
    } catch (e: any) {
      logger.log("error", "link-token", { err: e });
      res.status(500).json({ error: e.response?.data?.error_message || e.message });
    }
  });

  router.post("/exchange", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { publicToken } = req.body;
      if (!publicToken) return res.status(400).json({ error: "publicToken required" });
      const exchangeReq = { public_token: publicToken };
      const { data } = await plaid.itemPublicTokenExchange(exchangeReq);
      logger.log("info", "plaid itemPublicTokenExchange", { meta: { userId }, input: exchangeReq, output: data });

      const itemReq = { access_token: data.access_token };
      const item = await plaid.itemGet(itemReq);
      logger.log("info", "plaid itemGet", { input: itemReq, output: item.data });

      const itemData = item.data.item;
      await prisma.items.create({
        data: {
          id: data.item_id,
          user_id: userId,
          access_token: data.access_token,
          institution_id: itemData.institution_id ?? null,
          institution_name: itemData.institution_name ?? null,
          created_at: itemData.created_at ? new Date(itemData.created_at) : null,
          consented_products: itemData.consented_products ?? undefined,
          consented_data_scopes: itemData.consented_data_scopes ?? undefined,
          consented_use_cases: itemData.consented_use_cases ?? undefined,
          consent_expiration_time: itemData.consent_expiration_time ?? null,
          available_products: itemData.available_products ?? undefined,
          billed_products: itemData.billed_products ?? undefined,
          products: itemData.products ?? undefined
        }
      });

      const accountsReq = { access_token: data.access_token };
      const accounts = await plaid.accountsGet(accountsReq);
      logger.log("info", "plaid accountsGet", { input: accountsReq, output: accounts.data });

      await prisma.accounts.createMany({
        data: accounts.data.accounts.map((account) => ({
          id: account.account_id,
          item_id: data.item_id,
          user_id: userId,
          name: account.name ?? null,
          official_name: account.official_name ?? null,
          type: account.type ?? null,
          subtype: account.subtype ?? null,
          balances: (account.balances as any) ?? undefined,
          mask: account.mask ?? null,
          holder_category: account.holder_category ?? null
        }))
      });

      res.json({ success: true });
    } catch (e: any) {
      logger.log("error", "exchange", { err: e, plaid: e?.response?.data, meta: { userId: req.body?.userId } });
      res.status(500).json({ error: e.response?.data?.error_message || e.message });
    }
  });

  return router;
};
