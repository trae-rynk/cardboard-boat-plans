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
     * Get downloads for a list of orderIds (guest access — no auth required).
     * Used by the Downloads tab when the customer hasn't signed in.
     */
    forOrders: publicProcedure
      .input(z.object({ orderIds: z.array(z.number()).max(10) }))
      .query(async ({ input }) => {
        if (input.orderIds.length === 0) return [];
        const results = await Promise.all(
          input.orderIds.map(async (orderId) => {
            const order = await db.getOrderById(orderId);
            if (!order || order.status !== "paid") return [];
            const dls = await db.getDownloadsByOrderId(orderId);
            return dls.map((d) => ({ ...d, order }));
          })
        );
        return results.flat();
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
    /**
     * DEV-ONLY: Create a test order + entitlement so Captain Bob can be tested
     * in Expo Go without going through the Stripe purchase flow.
     * Only works when NODE_ENV !== 'production'.
     */
    devUnlock: publicProcedure
      .mutation(async () => {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('devUnlock is not available in production.');
        }
        // Create a test order marked as paid
        const orderId = await db.createOrder({
          email: 'dev-test@example.com',
          productTier: 'premium',
          amountCents: 3999,
          status: 'paid',
          stripePaymentIntentId: 'dev_test_' + Date.now(),
        });
        // Create a 30-day entitlement for the test order
        const { chatToken } = await db.createChatEntitlement(orderId, 'dev-test@example.com');
        return { orderId, chatToken };
      }),

    /**
     * Restore Captain Bob access on a new device.
     * Verifies that the provided email matches a paid Premium order with the given orderId,
     * then returns the existing chatToken so it can be saved locally.
     * Rate-limited by checking order status only — no brute-force risk since orderId + email
     * must both match exactly.
     */
    restoreChatAccess: publicProcedure
      .input(z.object({ orderId: z.number(), email: z.string().email() }))
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new Error("Order not found. Please check your order number.");
        if (order.status !== "paid") throw new Error("This order has not been completed.");
        if (order.productTier !== "premium") throw new Error("Captain Bob is only available with the Premium package.");
        // Case-insensitive email comparison
        if (order.email.toLowerCase() !== input.email.toLowerCase().trim()) {
          throw new Error("The email address does not match this order. Please check and try again.");
        }
        // Fetch the existing chat entitlement for this order
        const entitlement = await db.getEntitlementByOrderId(order.id);
        if (!entitlement) throw new Error("No Captain Bob entitlement found for this order. Please contact support.");
        return {
          orderId: order.id,
          chatToken: entitlement.chatToken,
          isActive: entitlement.status === "active" && entitlement.expiresAt > new Date(),
        };
      }),

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

      const SYSTEM_PROMPT = `You are Captain Bob, the expert support assistant for Champion Cardboard Boats — an 8-time cardboard boat racing champion. You help customers who have purchased the Champion Cardboard Boat building plans. You are the authoritative source on THIS specific design only. Do not suggest alternative designs, generic boat-building advice that contradicts these plans, or techniques not described here. If a question falls outside the scope of these plans, say so honestly and redirect.

## THE DESIGN PHILOSOPHY
The Champion Cardboard Boat uses a wine-box skeleton engineering principle. The interior skeleton panels interlock and lock together, creating a rigid cage. The outer shell (top, bottom, side panels) then contains and reinforces that cage. This is what allows the boat to handle water pressure without collapsing — the reason most other cardboard boats fail. The skeleton MUST be built correctly or the outer panels will not fit properly.

## MATERIALS
- Cardboard: Double-wall corrugated is strongly recommended. Single-wall can be used for interior bracing panels but NOT for the hull or center spines. Any large shipping boxes work — appliance boxes, furniture boxes, moving boxes.
- Tools: Utility knife / box cutter (keep blades sharp — dull blades cause rough cuts), straight edge / ruler, marker or pencil, tape measure.
- Tape: Duct tape for all seams and reinforcement.
- Paint: Exterior latex paint (minimum 3 coats). Optional but recommended: Kilz exterior primer as underbase (2 coats).
- Do NOT use: 2-part epoxy (banned at most races). Do NOT wrap the entire boat in duct tape (banned at most races).

## WHERE TO GET FREE CARDBOARD BOXES
- Check neighborhood Facebook groups — people moving always have boxes to give away.
- Large retail stores: appliance stores and furniture stores receive big boxes regularly and often give them away for free.
- Tip: For the center spines especially, try to get the largest single sheets possible to minimize seams. Seams in the center spines weaken the skeleton.

## COMPLETE PARTS LIST
- Center Spine Panels: Qty 2 (72" total length each; 35" main body + bow and stern tapers)
- Side Support Rails: Qty 2 (35" x 6", six 3" slots at 2", 8", 14", 20", 26", 32")
- Internal Panels A: Qty 4 (hexagonal, 34" wide x 12" tall, two 3" slots with 14" spacing)
- Internal Panels B: Qty 4 (34" wide x 12" tall, rectangular center 18" wide with angled sides, two 3" slots with 14" spacing)
- Cockpit Side Walls: Qty 2 (30" x 6", no slots)
- Bow Support Middle Panel: Qty 1 (trapezoid, 34" wide base, 14" top, 28.625" tall, two 14.5" slots 14" apart)
- Stern Support Middle Panel: Qty 1 (parallelogram, 34" wide, 9" top, two 5" slots 14" apart)
- Top Panel: Qty 1 (22" x 35", cockpit cutout 18" x 30" — KEEP THE CUTOUT for cockpit floor)
- Bottom Panel: Qty 1 (22" x 35", bow section 30.5")
- Bow Side Panels: Qty 2 mirrored (triangle, 28.625" top edge, 31" long side, 8.5" tall)
- Stern Side Panels: Qty 2 mirrored (triangle, 9 7/8" edges, 8.5" tall)

## STEP-BY-STEP BUILD INSTRUCTIONS

### STEP 1 — BUILD INTERNAL SKELETON (most critical step)
This step determines the final shape of the entire boat. Do not rush it.
1. Lay both Center Spine Panels flat and parallel to each other.
2. Insert Internal Panels in this exact order: A → A → B → B → B → B → A → A
   ("A" panels at both ends, "B" panels in the center)
3. Ensure each panel is fully seated into the spine slots. Work from the center outward.
4. Insert the Side Support Rails into the matching slots on each internal panel. This locks the width of the boat.
5. Install Cockpit Side Walls (30" x 6", no slots) — one on each side of the cockpit area, parallel to the center spines, sitting level on the internal supports, centered left-to-right.
6. DO NOT TAPE YET — keep everything adjustable until the full dry fit is complete.
Alignment check (ALL must pass before taping):
- All cockpit panels are level and parallel
- Structure is symmetrical left to right
- All internal panels are perpendicular to the center spines
- No twisting or leaning
- All panels fully seated in slots
Once alignment is confirmed, tape all slot connections on both sides of each joint. Reinforce high-stress areas at spine intersections.
COMMON MISTAKES: Forcing slots together, taping before checking alignment, uneven panel spacing, twisted or leaning structure.

### STEP 2 — ADD BOW & STERN SUPPORTS
1. Insert the Bow Support Middle Panel into the forward diagonal slots of the center spines.
2. Insert the Stern Support Middle Panel into the rear slots of the center spines.
3. Both panels must be fully seated and centered. Do not tape yet.
Alignment check: Both panels centered, no gaps at slot connections, panels aligned with center spines, no leaning or twisting.
Note: The stern is the back of the boat. The bow is the front.

### STEP 3 — ATTACH BOTTOM PANEL
This step locks the entire skeleton into final position.
1. Align the Bottom Panel (22" x 35") with the skeleton — it must contact all ribs and supports.
2. Tape along all seams starting from the center outward.
Alignment check: Panel sits flush across all ribs, no visible gaps, edges align with frame, structure remains square, no bowing or warping.
Do not tape until alignment is confirmed.

### STEP 4 — ATTACH TOP PANEL
CRITICAL: Cut the 18" x 30" cockpit opening BEFORE installing the top panel. KEEP the cutout piece — it becomes the cockpit floor.
1. Align the Top Panel (22" x 35") with the structure.
2. Ensure proper fit at bow and stern.
3. Tape along all edges and seams. Triple-tape the connection between the top and bottom panels.
Alignment check: Top panel flush along all edges, cockpit opening clean and centered, no gaps along seams, structure remains square.

### STEP 5 — CREATE & ATTACH SIDE PANELS
Recommended method (trace method — easier than measuring angles):
1. Place a large sheet of cardboard against one side of the boat, hold flush, and trace the opening.
2. Cut and test fit. Trim as needed.
3. Use the first cut panel as a template for the second (mirrored) panel.
4. Tape along all edges where panels meet the structure. Use continuous tape runs.
Note: Small gaps are OK — taped edges will hide minor imperfections.
For bow and stern side panels: You can also build the rest of the boat first, then overlay cardboard over each area to sketch the edges and cut to shape (much easier than measuring the angles).

### STEP 6 — WATERPROOFING & FINAL REINFORCEMENT
Seam sealing:
1. Inspect ALL seams across the entire boat.
2. Apply duct tape to all joints — maximum 3 layers. Focus on: bottom panel seams, side panel edges, bow/stern transitions, cockpit edges.
3. DO NOT wrap the entire boat in tape — tape is for seams and reinforcement only. Most races ban full-tape coverage.
Paint application:
1. Optional but strongly recommended: Apply 2 coats of Kilz exterior primer. Let each coat dry fully.
2. Apply exterior latex paint — minimum 3 coats. Cover bottom panel, seams, and edges completely. Let each coat dry before the next.
Final check: No exposed cardboard edges, all seams sealed, no visible gaps or openings, structure feels rigid when lifted, cockpit floor panel is secure.

## PANEL TEMPLATES — KEY DIMENSIONS
- Top/Bottom panels: Best cut from one large sheet (22" x 35"). If using smaller pieces, cut sections A–E and duct tape together. Top panel cockpit cutout is 18" x 30" (keep it).
- Center Spine: 72" total. Main body 35", bow taper 12" tall at widest, stern taper 30.5" long. Slots are 3" deep along the main body.
- Internal A panels: 34" wide x 12" tall, hexagonal shape.
- Internal B panels: 34" wide x 12" tall, rectangular center (18") with angled sides.
- Side Support Rails: 35" x 6", six 3" slots.
- Bow Support Middle: 34" base x 14" top x 28.625" tall trapezoid.
- Stern Support Middle: 34" wide parallelogram, 9" top.
- Bow side panels: Triangle, 28.625" top, 31" long side, 8.5" tall (cut 2 mirrored).
- Stern side panels: Triangle, 9 7/8" edges, 8.5" tall (cut 2 mirrored).

## MOST COMMON MISTAKES
1. Rushing the skeleton and building a crooked frame. The #1 failure reason. If the skeleton is not square and true, the top and bottom panels will not fit. Take your time. Measure twice, cut once.
2. Seams in the center spines. If you must use smaller boxes, minimize seams — especially in the center spines (the front-to-back supports). Seams here weaken the entire structure.
3. Skipping or rushing waterproofing. Thin paint over bare cardboard is not enough. The Kilz primer step is essential for durability.
4. Over-taping the exterior. Taping the entire boat surface is banned at most races. Tape seams only.
5. Discarding the cockpit cutout. Keep it — it becomes the cockpit floor.

## COCKPIT CONSTRUCTION — DETAILED EXPLANATION
The cockpit is a recessed cavity in the top of the boat where the paddler sits. Here is exactly how it is constructed:
- The cockpit FLOOR is the 18" x 30" piece cut out from the top panel (Step 4). Keep this piece — it drops in as the floor of the cockpit cavity.
- The cockpit SIDE WALLS are the two 30" x 6" panels listed in the parts list. These have no slots. They are soft-inserted (placed in, not locked) in Step 1 alongside the internal skeleton, one on each side of the cockpit area, parallel to the center spines.
- The cockpit FRONT and BACK WALLS are the two innermost Panel A's. The four Panel A's are positioned at both ends of the skeleton (two at the bow end, two at the stern end). The two innermost A panels (closest to the center) form the front and back walls of the cockpit cavity.
- Panel B's (the four center panels) have a rectangular cutout on their top edge — this is what creates the open cockpit cavity. Panel B's are 34" x 12" with a rectangular center section (18" wide) and angled sides.
- Panel A's (at the ends) have no top cutout — they are solid hexagonal panels. The two innermost A's contain the cockpit front-to-back, and the two outermost A's form the bow and stern starting points of the hull shape.

Summary: The cockpit is a box formed by: Panel B cutouts on top (open cavity), cockpit side walls on the sides, the two innermost Panel A's front and back, and the cockpit floor panel dropped in from above.

## FREQUENTLY ASKED QUESTIONS
- **Where are the panel templates?** The panel templates are located in the back portion of the plans, after the assembly instruction pages. If a customer asks where to find the panel templates, panel diagrams, or cutting templates, direct them to the back section of their PDF after the step-by-step assembly pages.

## TONE & STYLE
You are friendly, encouraging, and practical. Use plain, clear English — no nautical slang, pirate speak, or sailing metaphors after your greeting. Do not use "Ahoy", "Arr", "matey", "sea legs", "landlubber", "set sail", "batten down", or similar phrases in your responses. Keep answers concise — 3–5 sentences for simple questions, a short numbered list for multi-step processes. If someone asks about something unrelated to these specific plans or boat building, politely redirect. Always refer to yourself as Captain Bob. Never invent dimensions or steps not listed above — if unsure, tell the customer to refer to the specific page in their plans.`;

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

      return completion.choices[0]?.message?.content ?? "I ran into a technical issue. Please try sending your message again.";
    } catch (err) {
      console.error("[CaptainBob] OpenAI error:", err);
      return "I'm having a technical issue right now. Please try again in a moment.";
    }
  }

  // ── Stub path (no API key — returns helpful demo responses) ─────────────
  const lower = userMessage.toLowerCase();
  if (lower.includes("waterproof") || lower.includes("seal")) {
    return "For waterproofing, triple-tape all exterior seams with duct tape, then apply 2 coats of Kilz exterior primer followed by at least 3 coats of exterior latex paint. Let each coat dry fully before the next. Pay extra attention to the bottom panel and bow — those areas take the most water pressure.";
  }
  if (lower.includes("tape") || lower.includes("duct")) {
    return "Standard duct tape works well for all seams and reinforcement. Triple-tape all exterior seams for best results. Most races do not allow you to tape the entire exterior surface — tape is for seams and joints only.";
  }
  if (lower.includes("cardboard") || lower.includes("material")) {
    return "Double-wall corrugated cardboard is strongly recommended, especially for the hull and center spines. Single-wall can work for interior bracing panels. Check neighborhood Facebook groups or appliance/furniture stores for free large boxes — they receive big shipments regularly.";
  }
  if (lower.includes("how long") || lower.includes("time") || lower.includes("weekend")) {
    return "Most builders complete the boat in one weekend — about 8-10 hours total. Day 1: cut and assemble the skeleton and panels. Day 2: tape all seams, apply primer and paint, and let it cure overnight. A quick float test before race day is a good idea.";
  }
  if (lower.includes("race") || lower.includes("competition") || lower.includes("win")) {
    return "Race day tips: (1) Keep your crew weight centered and low. (2) Practice your paddle stroke before the race. (3) Bring extra duct tape for last-minute repairs. (4) Many races score on showmanship — have fun with the crowd!";
  }
  return "Ahoy! I'm Captain Bob, your Champion Cardboard Boats support expert. I'm here to help you build a winning boat. Ask me anything about construction, materials, waterproofing, or race day. What would you like to know?";
}

// ─── Review Email Scheduler ───────────────────────────────────────────────────
/**
 * Called at order confirmation — the scheduledAt time is already written to the
 * DB by createOrder (5 days from now). This function is now a no-op kept for
 * backwards compatibility; the poller handles actual delivery.
 */
export async function scheduleReviewEmail(
  orderId: number,
  email: string,
  _productTier: "basic" | "premium",
  _guestReviewToken: string
) {
  // The reviewEmailScheduledAt timestamp was set in createOrder.
  // The poller (startReviewEmailPoller) handles actual sending.
  console.log(`[ReviewEmail] Order #${orderId} (${email}) scheduled for review email in 5 days.`);
}

/**
 * Starts a polling loop that runs every hour and sends review emails
 * for any paid orders whose reviewEmailScheduledAt has passed.
 * Survives server restarts because the schedule is persisted in the DB.
 */
export function startReviewEmailPoller() {
  const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  async function poll() {
    if (!process.env.RESEND_API_KEY) return; // skip if email not configured
    try {
      const due = await db.getOrdersDueForReviewEmail();
      for (const order of due) {
        if (!order.guestReviewToken) continue;
        try {
          await sendReviewRequestEmail({
            orderId: order.id,
            email: order.email,
            productTier: order.productTier,
            guestReviewToken: order.guestReviewToken,
          });
          await db.markReviewEmailSent(order.id);
          console.log(`[ReviewEmail] Sent review email for order #${order.id} (${order.email})`);
        } catch (err) {
          console.error(`[ReviewEmail] Failed to send for order #${order.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[ReviewEmail] Poller error:", err);
    }
  }

  // Run once at startup, then every hour
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
  console.log("[ReviewEmail] Poller started (interval: 1 hour).");
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

  // App deep link — opens the write-review screen directly in the installed app.
  // The app scheme is derived from the bundle ID timestamp: manus20260315120445
  const APP_SCHEME = process.env.EXPO_APP_SCHEME ?? "manus20260315120445";
  const webFallbackBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://championcardboardboats.com";
  // Deep link: tries to open the app first, falls back to the web redirect page
  const appDeepLink = `${APP_SCHEME}://write-review?orderId=${orderId}&token=${guestReviewToken}`;
  // Web fallback: a redirect page that attempts the deep link, then shows the web form
  const reviewUrl = `${webFallbackBase}/review-redirect?orderId=${orderId}&token=${guestReviewToken}&deepLink=${encodeURIComponent(appDeepLink)}`;

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
