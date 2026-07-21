import type { Request, Response } from "express";
import type Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { ACCESS_LEVEL_FREE, ACCESS_LEVEL_PAID } from "../lib/entitlements";
import { logger } from "../logger";

const HANDLED = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

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
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      res.status(500).json({ error: "STRIPE_PRO_PRICE_ID is not configured" });
      return;
    }

    const eventSub = event.data.object as Stripe.Subscription;
    const customerId = customerIdOf(eventSub);

    const listed = await stripe.subscriptions.list({
      customer: customerId,
      price: priceId,
      status: "all",
      limit: 10,
    });

    const sub =
      listed.data.find((s) => PAID_STATUSES.has(s.status)) ?? listed.data[0] ?? null;
    const status = sub?.status ?? "canceled";
    const access_level = PAID_STATUSES.has(status) ? ACCESS_LEVEL_PAID : ACCESS_LEVEL_FREE;

    const where = {
      OR: [
        ...(sub ? [{ stripe_subscription_id: sub.id }] : []),
        { stripe_customer_id: customerId },
      ],
    };

    const rows = await prisma.subscriptions.findMany({
      where,
      select: { user_id: true },
    });

    const result = await prisma.subscriptions.updateMany({
      where,
      data: {
        stripe_subscription_id: sub?.id ?? null,
        stripe_subscription_status: status,
        access_level,
      },
    });

    if (result.count > 0) {
      await Promise.all(
        rows.map((row) =>
          logger.to_db(
            "INFO",
            row.user_id,
            "STRIPE WEBHOOK",
            {
              event_type: event.type,
              stripe_customer_id: customerId,
              stripe_subscription_id: sub?.id ?? null,
              stripe_subscription_status: status,
              access_level,
            },
            { event, subscriptions: listed.data }
          )
        )
      );
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error("stripe webhook error:", e?.message ?? e);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
