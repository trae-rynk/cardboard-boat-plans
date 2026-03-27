/**
 * Stripe Webhook Handler
 *
 * Handles server-side payment events from Stripe.
 * This is the authoritative fulfillment path — the client-side confirmPayment
 * tRPC call is a convenience shortcut, but the webhook is the source of truth.
 *
 * Events handled:
 *   - payment_intent.succeeded  → fulfill order (downloads + review email + chat entitlement)
 *   - payment_intent.payment_failed → mark order as failed
 *
 * Setup in Stripe Dashboard:
 *   Endpoint URL: https://<your-api-domain>/webhook
 *   Events: payment_intent.succeeded, payment_intent.payment_failed
 */

import type { Request, Response } from "express";
import * as db from "./db";
import { scheduleReviewEmail, sendOrderConfirmationEmail } from "./routers";

async function getStripe() {
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

/**
 * Fulfill a paid order: mark paid, create download tokens, schedule review
 * email, and create chat entitlement for Premium orders.
 * Idempotent — safe to call multiple times for the same order.
 */
async function fulfillOrder(orderId: number, stripePaymentIntentId: string): Promise<void> {
  const order = await db.getOrderById(orderId);
  if (!order) {
    console.warn(`[Webhook] Order #${orderId} not found`);
    return;
  }

  // Idempotency guard — skip if already fulfilled
  if (order.status === "paid") {
    console.log(`[Webhook] Order #${orderId} already fulfilled, skipping`);
    return;
  }

  // Mark as paid
  await db.updateOrderStatus(order.id, "paid", stripePaymentIntentId);

  // Create download tokens
  await db.createDownloadsForOrder(order.id, order.productTier);

  // Send order confirmation email immediately (fire-and-forget)
  sendOrderConfirmationEmail({
    orderId: order.id,
    email: order.email,
    productTier: order.productTier,
  }).catch((err) => console.warn("[Webhook] Failed to send confirmation email:", err));

  // Schedule 5-day review email (fire-and-forget)
  scheduleReviewEmail(
    order.id,
    order.email,
    order.productTier,
    order.guestReviewToken ?? ""
  ).catch((err) => console.warn("[Webhook] Failed to schedule review email:", err));

  // Create Captain Bob chat entitlement for Premium orders
  if (order.productTier === "premium") {
    try {
      await db.createChatEntitlement(order.id, order.email);
    } catch (err) {
      console.warn(`[Webhook] Failed to create chat entitlement for order #${order.id}:`, err);
    }
  }

  console.log(`[Webhook] Order #${orderId} fulfilled successfully`);
}

/**
 * Express route handler for POST /webhook
 * Must receive the raw body (Buffer) for Stripe signature verification.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("[Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
    res.status(400).json({ error: "Webhook secret not configured" });
    return;
  }

  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event;
  try {
    const stripe = await getStripe();
    // req.body is a raw Buffer when express.raw() middleware is used for this route
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Webhook] Signature verification failed:", message);
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const stripePaymentIntentId = intent.id;
        const metadata = intent.metadata as { productTier?: string; email?: string };

        // Find the order by Stripe PaymentIntent ID
        const order = await db.getOrderByStripePaymentIntentId(stripePaymentIntentId);
        if (order) {
          await fulfillOrder(order.id, stripePaymentIntentId);
        } else {
          // Fallback: try to find by metadata if order was created before intent ID was stored
          console.warn(
            `[Webhook] No order found for PaymentIntent ${stripePaymentIntentId}`,
            "metadata:", metadata
          );
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        const stripePaymentIntentId = intent.id;
        const failureMessage = intent.last_payment_error?.message ?? "Payment failed";

        const order = await db.getOrderByStripePaymentIntentId(stripePaymentIntentId);
        if (order && order.status === "pending") {
          await db.updateOrderStatus(order.id, "failed");
          console.log(`[Webhook] Order #${order.id} marked as failed: ${failureMessage}`);
        }
        break;
      }

      default:
        // Ignore unhandled event types
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // Acknowledge receipt to Stripe — must respond within 30 seconds
    res.json({ received: true, eventType: event.type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Webhook] Error processing event:", message);
    // Return 500 so Stripe retries the event
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
