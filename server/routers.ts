import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

// ─── Stripe helper (lazy-loaded so app works without key during dev) ──────────
async function getStripe() {
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Orders ────────────────────────────────────────────────────────────────
  orders: router({
    /**
     * Create a Stripe PaymentIntent and a pending order record.
     * Returns the client secret needed by the frontend to confirm payment.
     */
    createPaymentIntent: publicProcedure
      .input(
        z.object({
          productTier: z.enum(["basic", "premium"]),
          email: z.string().email(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const PRICES = { basic: 1999, premium: 3999 };
        const amountCents = PRICES[input.productTier];

        // Create Stripe PaymentIntent
        let clientSecret: string | null = null;
        let stripePaymentIntentId: string | null = null;

        try {
          const stripe = await getStripe();
          const intent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: "usd",
            receipt_email: input.email,
            metadata: {
              productTier: input.productTier,
              email: input.email,
            },
          });
          clientSecret = intent.client_secret;
          stripePaymentIntentId = intent.id;
        } catch (err) {
          // If Stripe is not configured, we still create the order for demo purposes
          console.warn("[Stripe] Not configured, creating demo order:", err);
        }

        // Create pending order in DB
        const orderId = await db.createOrder({
          userId: ctx.user?.id ?? null,
          email: input.email,
          productTier: input.productTier,
          amountCents,
          stripePaymentIntentId: stripePaymentIntentId ?? undefined,
          stripeClientSecret: clientSecret ?? undefined,
          status: "pending",
        });

        return {
          orderId,
          clientSecret,
          amountCents,
          stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
        };
      }),

    /**
     * Confirm a payment (called after Stripe confirms on the client).
     * Marks the order as paid and creates download tokens.
     */
    confirmPayment: publicProcedure
      .input(
        z.object({
          orderId: z.number(),
          stripePaymentIntentId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new Error("Order not found");

        // Verify with Stripe if configured
        if (process.env.STRIPE_SECRET_KEY && input.stripePaymentIntentId) {
          const stripe = await getStripe();
          const intent = await stripe.paymentIntents.retrieve(input.stripePaymentIntentId);
          if (intent.status !== "succeeded") {
            throw new Error(`Payment not completed: ${intent.status}`);
          }
        }

        // Mark as paid
        await db.updateOrderStatus(order.id, "paid", input.stripePaymentIntentId);

        // Create download tokens
        const downloads = await db.createDownloadsForOrder(order.id, order.productTier);

        return {
          success: true,
          orderId: order.id,
          productTier: order.productTier,
          downloads: downloads.map((d) => ({
            token: d.token,
            displayName: d.displayName,
            assetType: d.assetType,
            fileSizeBytes: d.fileSizeBytes,
          })),
        };
      }),

    /**
     * Get all orders for the currently logged-in user.
     */
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrdersByUserId(ctx.user.id);
    }),

    /**
     * Get order by ID (public — used after purchase to show confirmation).
     */
    getOrder: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) return null;
        return order;
      }),
  }),

  // ─── Downloads ─────────────────────────────────────────────────────────────
  downloads: router({
    /**
     * Get all downloads for a specific order (by orderId).
     */
    forOrder: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order || order.status !== "paid") return [];
        return db.getDownloadsByOrderId(input.orderId);
      }),

    /**
     * Get all downloads for the logged-in user across all their orders.
     */
    myDownloads: protectedProcedure.query(async ({ ctx }) => {
      return db.getDownloadsForUser(ctx.user.id);
    }),

    /**
     * Resolve a download token to a file URL.
     * In production, this would return a signed S3 URL.
     * For now, returns a placeholder download URL.
     */
    resolveToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const download = await db.getDownloadByToken(input.token);
        if (!download) throw new Error("Invalid download token");

        // Check expiry
        if (download.expiresAt && new Date() > download.expiresAt) {
          throw new Error("Download link has expired");
        }

        await db.incrementDownloadCount(input.token);

        // In production: generate a signed S3 URL here
        // For now: return a placeholder URL based on asset type
        const PLACEHOLDER_URLS: Record<string, string> = {
          pdf_plans: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1",
          video_series: "https://example.com/video-series",
          design_hacks: "https://example.com/design-hacks",
        };

        return {
          url: PLACEHOLDER_URLS[download.assetType] ?? "#",
          displayName: download.displayName,
          assetType: download.assetType,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
