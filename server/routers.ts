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
          stripePaymentIntentId,
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

        // Create Captain Bob chat entitlement for Premium orders
        let chatToken: string | undefined;
        if (order.productTier === "premium") {
          try {
            const entitlement = await db.createChatEntitlement(order.id, order.email);
            chatToken = entitlement.chatToken;
          } catch (err) {
            console.warn("[Chat] Failed to create entitlement for order #", order.id, err);
          }
        }

        return {
          success: true,
          orderId: order.id,
          productTier: order.productTier,
          guestReviewToken: order.guestReviewToken,
          chatToken,
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

  // ─── Captain Bob Chat ───────────────────────────────────────────────────────────
  chat: router({
    /**
     * Get the chat entitlement status for a Premium order.
     * Returns days remaining, messages remaining, and active status.
     */
    getEntitlement: publicProcedure
      .input(z.object({ orderId: z.number(), chatToken: z.string() }))
      .query(async ({ input }) => {
        const entitlement = await db.getEntitlementByToken(input.chatToken);
        if (!entitlement || entitlement.orderId !== input.orderId) return null;

        const now = new Date();
        const isExpiredByDate = entitlement.expiresAt < now;
        const isExpiredByCount = entitlement.messageCount >= entitlement.messageLimit;
        const isActive = entitlement.status === "active" && !isExpiredByDate && !isExpiredByCount;

        const msRemaining = Math.max(0, entitlement.expiresAt.getTime() - now.getTime());
        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
        const messagesRemaining = Math.max(0, entitlement.messageLimit - entitlement.messageCount);

        return {
          id: entitlement.id,
          isActive,
          daysRemaining,
          messagesRemaining,
          messageLimit: entitlement.messageLimit,
          messageCount: entitlement.messageCount,
          expiresAt: entitlement.expiresAt.toISOString(),
          extensionCount: entitlement.extensionCount,
          status: isExpiredByDate || isExpiredByCount ? "expired" : entitlement.status,
        };
      }),

    /**
     * Get the last 50 messages for a chat session.
     */
    getHistory: publicProcedure
      .input(z.object({ orderId: z.number(), chatToken: z.string() }))
      .query(async ({ input }) => {
        const entitlement = await db.getEntitlementByToken(input.chatToken);
        if (!entitlement || entitlement.orderId !== input.orderId) return [];
        return db.getChatHistory(entitlement.id, 50);
      }),

    /**
     * Send a message to Captain Bob and get a reply.
     * Enforces message cap and expiry window.
     */
    sendMessage: publicProcedure
      .input(
        z.object({
          orderId: z.number(),
          chatToken: z.string(),
          message: z.string().min(1).max(1000),
        })
      )
      .mutation(async ({ input }) => {
        const entitlement = await db.getEntitlementByToken(input.chatToken);
        if (!entitlement || entitlement.orderId !== input.orderId) {
          throw new Error("Invalid chat token.");
        }

        // Enforce expiry
        if (entitlement.expiresAt < new Date()) {
          throw new Error("EXPIRED: Your 30-day support window has ended.");
        }

        // Enforce message cap
        if (entitlement.messageCount >= entitlement.messageLimit) {
          throw new Error("LIMIT_REACHED: You have used all 1,000 messages in this support window.");
        }

        // Save user message
        await db.saveChatMessage(entitlement.id, "user", input.message);

        // Get recent history for context (last 10 exchanges = 20 messages)
        const history = await db.getChatHistory(entitlement.id, 20);
        const historyForAI = history
          .slice(0, -1) // exclude the message we just saved
          .map((m) => ({ role: m.role, content: m.content }));

        // Generate Captain Bob reply
        const reply = await captainBobReply(input.message, historyForAI);

        // Save assistant reply
        await db.saveChatMessage(entitlement.id, "assistant", reply);

        // Increment message count (counts only user messages)
        await db.incrementChatMessageCount(
          entitlement.id,
          entitlement.messageCount,
          entitlement.messageLimit
        );

        return {
          reply,
          messagesRemaining: Math.max(0, entitlement.messageLimit - entitlement.messageCount - 1),
        };
      }),

    /**
     * Purchase a 30-day extension for $9.99.
     * Creates a Stripe PaymentIntent for the extension SKU.
     */
    createExtensionIntent: publicProcedure
      .input(z.object({ orderId: z.number(), chatToken: z.string(), email: z.string().email() }))
      .mutation(async ({ input }) => {
        const entitlement = await db.getEntitlementByToken(input.chatToken);
        if (!entitlement || entitlement.orderId !== input.orderId) {
          throw new Error("Invalid chat token.");
        }

        const EXTENSION_PRICE_CENTS = 999; // $9.99

        let clientSecret: string | null = null;
        let stripePaymentIntentId: string | null = null;

        try {
          const stripe = await getStripe();
          const intent = await stripe.paymentIntents.create({
            amount: EXTENSION_PRICE_CENTS,
            currency: "usd",
            receipt_email: input.email,
            metadata: {
              type: "chat_extension",
              entitlementId: String(entitlement.id),
              orderId: String(input.orderId),
            },
          });
          clientSecret = intent.client_secret;
          stripePaymentIntentId = intent.id;
        } catch (err) {
          console.warn("[Stripe] Extension payment intent failed:", err);
        }

        return {
          clientSecret,
          stripePaymentIntentId,
          amountCents: EXTENSION_PRICE_CENTS,
          stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
        };
      }),

    /**
     * Confirm an extension purchase and extend the entitlement by 30 days.
     */
    confirmExtension: publicProcedure
      .input(
        z.object({
          orderId: z.number(),
          chatToken: z.string(),
          stripePaymentIntentId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const entitlement = await db.getEntitlementByToken(input.chatToken);
        if (!entitlement || entitlement.orderId !== input.orderId) {
          throw new Error("Invalid chat token.");
        }

        // Verify with Stripe if configured
        if (process.env.STRIPE_SECRET_KEY && input.stripePaymentIntentId) {
          const stripe = await getStripe();
          const intent = await stripe.paymentIntents.retrieve(input.stripePaymentIntentId);
          if (intent.status !== "succeeded") {
            throw new Error(`Extension payment not completed: ${intent.status}`);
          }
        }

        const newExpiresAt = await db.extendChatEntitlement(entitlement.id, entitlement.expiresAt);

        return {
          success: true,
          newExpiresAt: newExpiresAt.toISOString(),
          extensionCount: entitlement.extensionCount + 1,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Captain Bob AI ───────────────────────────────────────────────────────────
/**
 * Generates a Captain Bob reply.
 * Currently uses a smart stub — swap in OpenAI by setting OPENAI_API_KEY.
 */
async function captainBobReply(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  // ── OpenAI path (activated when OPENAI_API_KEY is set) ──────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const SYSTEM_PROMPT = `You are Captain Bob, the friendly expert support assistant for Champion Cardboard Boats.
You help customers who have purchased cardboard boat building plans.

Your expertise covers:
- Cardboard boat construction techniques (hull design, reinforcement, waterproofing)
- Materials: corrugated cardboard grades, duct tape, Gorilla tape, spray paint, polyurethane
- Build timeline planning (most boats take 1-2 weekends)
- Race strategy and competition tips
- Common mistakes and how to fix them
- The specific Champion Cardboard Boat plans (12-page PDF, step-by-step diagrams, panel templates)

Tone: Friendly, encouraging, nautical (occasional sailing metaphors welcome). Keep answers concise and practical.
If asked about something unrelated to boat building or the plans, politely redirect to your area of expertise.
Always refer to yourself as Captain Bob.`;

      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userMessage },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 400,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content ?? "Arr, I seem to have lost my sea legs for a moment. Please try again!";
    } catch (err) {
      console.error("[CaptainBob] OpenAI error:", err);
      return "Arr, I'm having a bit of trouble with my radio right now. Please try again in a moment!";
    }
  }

  // ── Stub path (no API key — returns helpful demo responses) ─────────────
  const lower = userMessage.toLowerCase();
  if (lower.includes("waterproof") || lower.includes("seal")) {
    return "Ahoy! For waterproofing, I recommend 3 coats of exterior polyurethane spray on all seams and the hull bottom. Let each coat dry fully (about 2 hours) before the next. Pay extra attention to the bow — that's where water pressure is highest in a race. 🚢";
  }
  if (lower.includes("tape") || lower.includes("duct")) {
    return "Great question! Gorilla tape is my top pick — it bonds better to cardboard than standard duct tape and holds up under water pressure. Use it on all external seams. For interior reinforcement, standard duct tape works fine and saves a few dollars. 🏆";
  }
  if (lower.includes("cardboard") || lower.includes("material")) {
    return "For the hull panels, use double-wall corrugated cardboard (the thicker kind from appliance boxes). Single-wall works for interior bracing but not the hull. Hardware stores sometimes give away appliance boxes for free — worth asking! 📦";
  }
  if (lower.includes("how long") || lower.includes("time") || lower.includes("weekend")) {
    return "Most builders complete the hull in one weekend — about 8-10 hours total. Day 1: cut and assemble the panels. Day 2: tape all seams, waterproof, and let it cure overnight. I'd recommend doing a quick float test in a bathtub before race day! ⏱️";
  }
  if (lower.includes("race") || lower.includes("competition") || lower.includes("win")) {
    return "Race day tips from an 8-time champion: (1) Keep your crew weight centered and low. (2) Practice your paddle stroke before the race. (3) Bring extra tape for last-minute repairs. (4) Smile for the crowd — half the judges score on showmanship! 🏅";
  }
  return `Ahoy! I'm Captain Bob, your Champion Cardboard Boats support expert. I'm here to help you build a winning boat! Ask me anything about construction techniques, materials, waterproofing, or race strategy. What would you like to know? ⚓`;
}

// ─── Review Email Scheduler ───────────────────────────────────────────────────
/**
 * Schedules a 5-day delayed review follow-up email.
 * Uses setTimeout for simplicity — in production this would be a job queue.
 * The delay is calculated from now so it works even if the server restarts
 * (the DB tracks reviewEmailSentAt so we never double-send).
 */
export async function scheduleReviewEmail(
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
  const appBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://championcardboardboats.com";
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
              <p style="margin:0;color:#f59e0b;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Champion Cardboard Boats</p>
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
                © 2026 Champion Cardboard Boats. All Rights Reserved.
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
    from: "Champion Cardboard Boats <noreply@championcardboardboats.com>",
    to: email,
    subject: `How did your ${productName} build go? ⭐`,
    html,
  });
}
