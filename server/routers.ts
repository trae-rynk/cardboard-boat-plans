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

        // Create pending order in DB (guestReviewToken auto-generated in db.createOrder)
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
     * Marks the order as paid, creates download tokens, and schedules the
     * 5-day review follow-up email.
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

        // Schedule 5-day review email (fire-and-forget, non-blocking)
        scheduleReviewEmail(order.id, order.email, order.productTier, order.guestReviewToken ?? "").catch(
          (err) => console.warn("[ReviewEmail] Failed to schedule:", err)
        );

        return {
          success: true,
          orderId: order.id,
          productTier: order.productTier,
          guestReviewToken: order.guestReviewToken,
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
     * Returns the guestReviewToken so the app can open the review modal.
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
     * No sign-in required — verified by orderId + guestReviewToken.
     * Works for all SKUs.
     */
    submit: publicProcedure
      .input(
        z.object({
          orderId: z.number(),
          guestReviewToken: z.string(),
          rating: z.number().int().min(1).max(5),
          title: z.string().max(120).optional(),
          body: z.string().max(2000).optional(),
          displayName: z.string().max(100).optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Verify the order token
        const order = await db.verifyOrderReviewToken(input.orderId, input.guestReviewToken);
        if (!order) {
          throw new Error("Invalid order or review token. Please use the link from your purchase confirmation.");
        }

        const existing = await db.getReviewByOrderId(input.orderId);

        if (existing) {
          // Update existing review
          await db.updateReview(existing.id, input.orderId, {
            rating: input.rating,
            title: input.title ?? null,
            body: input.body ?? null,
            displayName: input.displayName ?? null,
          });
          return { reviewId: existing.id, action: "updated" as const };
        } else {
          const reviewId = await db.createReview({
            orderId: input.orderId,
            email: order.email,
            productTier: order.productTier,
            rating: input.rating,
            title: input.title ?? null,
            body: input.body ?? null,
            displayName: input.displayName ?? null,
          });
          return { reviewId, action: "created" as const };
        }
      }),

    /**
     * Delete a review by orderId + guestReviewToken (no auth required).
     */
    delete: publicProcedure
      .input(z.object({ reviewId: z.number(), orderId: z.number(), guestReviewToken: z.string() }))
      .mutation(async ({ input }) => {
        const order = await db.verifyOrderReviewToken(input.orderId, input.guestReviewToken);
        if (!order) throw new Error("Invalid order or review token.");
        await db.deleteReview(input.reviewId, input.orderId);
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
     * Get the review for a specific order (by orderId + guestReviewToken).
     * No auth required.
     */
    myReview: publicProcedure
      .input(z.object({ orderId: z.number(), guestReviewToken: z.string() }))
      .query(async ({ input }) => {
        const order = await db.verifyOrderReviewToken(input.orderId, input.guestReviewToken);
        if (!order) return null;
        return db.getReviewByOrderId(input.orderId);
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

// ─── Review Email Scheduler ───────────────────────────────────────────────────
/**
 * Schedules a 5-day delayed review follow-up email.
 * Uses setTimeout for simplicity — in production this would be a job queue.
 * The delay is calculated from now so it works even if the server restarts
 * (the DB tracks reviewEmailSentAt so we never double-send).
 */
async function scheduleReviewEmail(
  orderId: number,
  email: string,
  productTier: "basic" | "premium",
  guestReviewToken: string
) {
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

  // In development/demo mode, we log instead of actually waiting 5 days
  if (process.env.NODE_ENV === "development" || !process.env.RESEND_API_KEY) {
    console.log(
      `[ReviewEmail] Would schedule review email for order #${orderId} (${email}) in 5 days.`,
      `Review link token: ${guestReviewToken}`
    );
    return;
  }

  setTimeout(async () => {
    try {
      // Re-fetch order to make sure it's still paid and email hasn't been sent
      const order = await db.getOrderById(orderId);
      if (!order || order.status !== "paid" || order.reviewEmailSentAt) return;

      await sendReviewRequestEmail({ orderId, email, productTier, guestReviewToken });
      await db.markReviewEmailSent(orderId);
      console.log(`[ReviewEmail] Sent review email for order #${orderId}`);
    } catch (err) {
      console.error(`[ReviewEmail] Failed to send for order #${orderId}:`, err);
    }
  }, FIVE_DAYS_MS);
}

/**
 * Sends the review request email via Resend.
 */
async function sendReviewRequestEmail({
  orderId,
  email,
  productTier,
  guestReviewToken,
}: {
  orderId: number;
  email: string;
  productTier: "basic" | "premium";
  guestReviewToken: string;
}) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const productName =
    productTier === "premium" ? "Premium Cardboard Boat Package" : "Builder Plan Package";

  // Deep link back into the app's review screen
  const appBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://championcardboardboatplans.com";
  const reviewUrl = `${appBaseUrl}/review?orderId=${orderId}&token=${guestReviewToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>How did your build go?</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#f59e0b;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Champion Cardboard Boat Plans</p>
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.3;">How did your build go? 🏆</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                Hi there,
              </p>
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                It's been 5 days since you downloaded the <strong>${productName}</strong> — we hope your build is coming along great!
              </p>
              <p style="margin:0 0 32px;color:#374151;font-size:16px;line-height:1.6;">
                We'd love to hear how it went. Your review helps other builders decide if these plans are right for them — and it only takes 30 seconds.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${reviewUrl}"
                       style="display:inline-block;background:#f59e0b;color:#1e3a5f;font-size:16px;font-weight:800;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
                      ⭐ Rate Your Experience
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:32px 0 0;color:#9ca3af;font-size:13px;text-align:center;line-height:1.6;">
                This is a one-time email for order #${orderId}. You won't receive any further follow-ups.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                © 2026 Champion Cardboard Boat Plans. All Rights Reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await resend.emails.send({
    from: "Champion Cardboard Boat Plans <noreply@championcardboardboatplans.com>",
    to: email,
    subject: `How did your ${productName} build go? ⭐`,
    html,
  });
}
