import express from "express";
import { logger } from "../logger";
import { plaid } from "../lib/plaid";
import { getInstitutionMetadata } from "../lib/institutions";
import {
  getEntitlements,
  paymentRequiredPayload
} from "../lib/entitlements";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

router.post("/link/token", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const userId = user.id;
    const entitlements = await getEntitlements(prisma, userId);
    if (!entitlements.can_add_bank) {
      return res.status(403).json(paymentRequiredPayload("add_bank"));
    }
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
    logger.log("info", `link token created (${daysRequested} days requested)`);
    res.json(data);
  } catch (e: any) {
    logger.log("error", `link token creation failed: ${e?.response?.data?.error_code || e?.message}`);
    res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

router.post("/link/exchange", async (req, res) => {
  try {
    const { prisma, user } = req as unknown as ServerRequest;
    const userId = user.id;
    const { publicToken } = req.body;
    if (!publicToken) return res.status(400).json({ error: "publicToken required" });

    if (!(await getEntitlements(prisma, userId)).can_add_bank) {
      return res.status(403).json(paymentRequiredPayload("add_bank"));
    }

    const exchangeReq = { public_token: publicToken };
    const { data } = await plaid.itemPublicTokenExchange(exchangeReq);
    logger.log("info", "public token exchanged for new item");

    // Re-check after Plaid exchange in case of concurrent link attempts
    if (!(await getEntitlements(prisma, userId)).can_add_bank) {
      try {
        await plaid.itemRemove({ access_token: data.access_token });
      } catch (removeErr: any) {
        logger.log("error", `item removal after gated exchange failed: ${removeErr?.response?.data?.error_code || removeErr?.message}`);
      }
      return res.status(403).json(paymentRequiredPayload("add_bank"));
    }

    const itemReq = { access_token: data.access_token };
    const item = await plaid.itemGet(itemReq);
    logger.log("info", "item details fetched");

    const itemData = item.data.item;
    const institution = await getInstitutionMetadata(itemData.institution_id);
    await prisma.items.create({
      data: {
        id: data.item_id,
        user_id: userId,
        access_token: data.access_token,
        institution_id: itemData.institution_id ?? null,
        institution_name: itemData.institution_name ?? null,
        inst_url: institution?.url ?? null,
        inst_logo: institution?.logo ?? null,
        inst_color: institution?.primary_color ?? null,
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
    logger.log("info", `accounts fetched for new item (${accounts.data.accounts.length} accounts)`);

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
    logger.log("error", `link exchange failed: ${e?.response?.data?.error_code || e?.message}`);
    res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

export default router;
