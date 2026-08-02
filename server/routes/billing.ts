import express from "express";
import { ensureSubscription, isPaidAccess } from "../lib/entitlements";
import { stripe } from "../lib/stripe";
import type { ServerRequest } from "../middleware/auth";
import { logger } from "../logger";

const router = express.Router();

function appBaseUrl() {
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("APP_BASE_URL is not configured");
  return base;
}

async function getOrCreateCustomer(req: ServerRequest) {
  const { user, prisma } = req;
  await ensureSubscription(prisma, user.id);
  const sub = await prisma.subscriptions.findUnique({
    where: { user_id: user.id },
    select: { stripe_customer_id: true }
  });
  if (sub?.stripe_customer_id) return sub.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { user_id: user.id }
  });
  const claimed = await prisma.subscriptions.updateMany({
    where: { user_id: user.id, stripe_customer_id: null },
    data: { stripe_customer_id: customer.id }
  });
  if (claimed.count === 0) {
    const winner = await prisma.subscriptions.findUnique({
      where: { user_id: user.id },
      select: { stripe_customer_id: true }
    });
    if (!winner?.stripe_customer_id) throw new Error("Failed to resolve Stripe customer");
    return winner.stripe_customer_id;
  }
  return customer.id;
}

async function portalUrl(req: ServerRequest) {
  const customerId = await getOrCreateCustomer(req);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}/account`
  });
  return session.url;
}

router.post("/billing/checkout", async (req, res) => {
  try {
    const serverReq = req as unknown as ServerRequest;
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) return res.status(500).json({ error: "STRIPE_PRO_PRICE_ID is not configured" });

    const sub = await ensureSubscription(serverReq.prisma, serverReq.user.id);
    if (isPaidAccess(sub.access_level)) {
      const url = await portalUrl(serverReq);
      return res.json({ url });
    }

    const customerId = await getOrCreateCustomer(serverReq);
    const base = appBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${base}/account?checkout=success`,
      cancel_url: `${base}/account?checkout=canceled`,
      client_reference_id: serverReq.user.id,
      metadata: { user_id: serverReq.user.id }
    });
    if (!session.url) return res.status(500).json({ error: "Checkout session missing URL" });
    res.json({ url: session.url });
  } catch (e: unknown) {
    logger.log("error", `billing checkout failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ error: "Checkout failed" });
  }
});

router.post("/billing/portal", async (req, res) => {
  try {
    const url = await portalUrl(req as unknown as ServerRequest);
    res.json({ url });
  } catch (e: unknown) {
    logger.log("error", `billing portal failed: ${e instanceof Error ? e.message : e}`);
    res.status(500).json({ error: "Portal session failed" });
  }
});

export default router;
