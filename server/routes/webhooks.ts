import type { Request, Response } from "express";
import type Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { ACCESS_LEVEL_FREE, ACCESS_LEVEL_PAID } from "../lib/entitlements";

const HANDLED = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

const hasProPrice = (sub: Stripe.Subscription) => {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  return !!priceId && sub.items.data.some((item) => item.price.id === priceId);
};

const customerIdOf = (sub: Stripe.Subscription) =>
  typeof sub.customer === "string" ? sub.customer : sub.customer.id;

export async function stripeWebhook(req: Request, res: Response) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET is not configured" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"] as string,
      webhookSecret
    );
  } catch {
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  if (!HANDLED.has(event.type)) {
    res.json({ received: true });
    return;
  }

  try {
    const eventSub = event.data.object as Stripe.Subscription;
    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(eventSub.id);
    } catch (err) {
      // Deleted subs are usually still retrievable; fall back to the event payload.
      if (event.type !== "customer.subscription.deleted") throw err;
      sub = eventSub;
    }

    if (!hasProPrice(sub)) {
      res.json({ received: true });
      return;
    }

    const status = sub.status;
    await prisma.subscriptions.updateMany({
      where: {
        OR: [
          { stripe_subscription_id: sub.id },
          { stripe_customer_id: customerIdOf(sub) },
        ],
      },
      data: {
        stripe_subscription_id: sub.id,
        stripe_subscription_status: status,
        access_level: PAID_STATUSES.has(status) ? ACCESS_LEVEL_PAID : ACCESS_LEVEL_FREE,
      },
    });

    res.json({ received: true });
  } catch (e: any) {
    console.error("stripe webhook error:", e?.message ?? e);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
