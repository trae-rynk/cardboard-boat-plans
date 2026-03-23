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

  // ─── Reviews ──────────────────────────────────────────────────────────────
  reviews: router({
    /**
     * Submit a new review (or update an existing one).
     * Only verified purchasers (paid orders) can submit.
     */
    submit: protectedProcedure
      .input(
        z.object({
          productTier: z.enum(["basic", "premium"]),
          rating: z.number().int().min(1).max(5),
          title: z.string().max(120).optional(),
          body: z.string().max(2000).optional(),
          displayName: z.string().max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verified purchase gate
        const hasPurchase = await db.hasVerifiedPurchase(ctx.user.id, input.productTier);
        if (!hasPurchase) {
          throw new Error("You must purchase this product before leaving a review.");
        }

        const existing = await db.getReviewByUserAndProduct(ctx.user.id, input.productTier);

        if (existing) {
          // Update existing review
          await db.updateReview(existing.id, ctx.user.id, {
            rating: input.rating,
            title: input.title ?? null,
            body: input.body ?? null,
            displayName: input.displayName ?? ctx.user.name ?? null,
          });
          return { reviewId: existing.id, action: "updated" as const };
        } else {
          // Find a qualifying paid order
          const userOrders = await db.getOrdersByUserId(ctx.user.id);
          const qualifyingOrder = userOrders.find(
            (o) => o.productTier === input.productTier && o.status === "paid"
          );
          if (!qualifyingOrder) throw new Error("No qualifying order found.");

          const reviewId = await db.createReview({
            userId: ctx.user.id,
            orderId: qualifyingOrder.id,
            productTier: input.productTier,
            rating: input.rating,
            title: input.title ?? null,
            body: input.body ?? null,
            displayName: input.displayName ?? ctx.user.name ?? null,
          });
          return { reviewId, action: "created" as const };
        }
      }),

    /**
     * Delete the current user's review for a product.
     */
    delete: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteReview(input.reviewId, ctx.user.id);
        return { success: true };
      }),

    /**
     * List published reviews for a product tier (public).
     */
    list: publicProcedure
      .input(
        z.object({
          productTier: z.enum(["basic", "premium"]),
          limit: z.number().int().min(1).max(50).default(10),
          offset: z.number().int().min(0).default(0),
        })
      )
      .query(async ({ input }) => {
        return db.getReviewsByProductTier(input.productTier, input.limit, input.offset);
      }),

    /**
     * Get rating stats (average, count, distribution) for a product tier.
     */
    stats: publicProcedure
      .input(z.object({ productTier: z.enum(["basic", "premium"]) }))
      .query(async ({ input }) => {
        return db.getRatingStats(input.productTier);
      }),

    /**
     * Get the current user's own review for a product (if any).
     */
    myReview: protectedProcedure
      .input(z.object({ productTier: z.enum(["basic", "premium"]) }))
      .query(async ({ ctx, input }) => {
        return db.getReviewByUserAndProduct(ctx.user.id, input.productTier);
      }),

    /**
     * Check if the current user can review a product (verified purchase gate).
     */
    canReview: protectedProcedure
      .input(z.object({ productTier: z.enum(["basic", "premium"]) }))
      .query(async ({ ctx, input }) => {
        const hasPurchase = await db.hasVerifiedPurchase(ctx.user.id, input.productTier);
        const existingReview = await db.getReviewByUserAndProduct(ctx.user.id, input.productTier);
        return {
          canReview: hasPurchase,
          hasReview: !!existingReview,
          reviewId: existingReview?.id ?? null,
        };
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
          pdf_plans: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663440726246/ffmRMeRiboUTqtrm.pdf",
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
