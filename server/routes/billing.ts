import express from "express";
import { ensureSubscription } from "../lib/entitlements";
import { stripe } from "../lib/stripe";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

function appBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
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
  await prisma.subscriptions.update({
    where: { user_id: user.id },
    data: { stripe_customer_id: customer.id }
  });
  return customer.id;
}

router.post("/billing/checkout", async (req, res) => {
  try {
    const serverReq = req as unknown as ServerRequest;
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) return res.status(500).json({ error: "STRIPE_PRO_PRICE_ID is not configured" });

    const customerId = await getOrCreateCustomer(serverReq);
    const base = appBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/account?checkout=success`,
      cancel_url: `${base}/account?checkout=canceled`,
      client_reference_id: serverReq.user.id,
      metadata: { user_id: serverReq.user.id }
    });
    if (!session.url) return res.status(500).json({ error: "Checkout session missing URL" });
    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/billing/portal", async (req, res) => {
  try {
    const serverReq = req as unknown as ServerRequest;
    const customerId = await getOrCreateCustomer(serverReq);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appBaseUrl()}/account`
    });
    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
