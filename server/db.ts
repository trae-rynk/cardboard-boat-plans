import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  chatEntitlements,
  chatMessages,
  downloads,
  orders,
  reviews,
  users,
  type InsertChatEntitlement,
  type InsertDownload,
  type InsertOrder,
  type InsertReview,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import crypto from "crypto";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Auto-generate a guestReviewToken if not provided
  // Schedule review email 5 days from now
  const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const orderData: InsertOrder = {
    ...data,
    guestReviewToken: data.guestReviewToken ?? crypto.randomBytes(32).toString("hex"),
    reviewEmailScheduledAt: data.reviewEmailScheduledAt ?? fiveDaysFromNow,
  };
  const result = await db.insert(orders).values(orderData);
  return (result as any)[0].insertId as number;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orders).where(eq(orders.id, id));
  return rows[0] ?? null;
}

export async function getOrderByStripePaymentIntentId(stripePaymentIntentId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, stripePaymentIntentId));
  return rows[0] ?? null;
}

export async function updateOrderStatus(
  id: number,
  status: "pending" | "paid" | "failed" | "refunded",
  stripePaymentIntentId?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(orders)
    .set({ status, ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}) })
    .where(eq(orders.id, id));
}

export async function markReviewEmailSent(orderId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(orders)
    .set({ reviewEmailSentAt: new Date() })
    .where(eq(orders.id, orderId));
}

export async function getOrdersByEmail(email: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.email, email)).orderBy(desc(orders.createdAt));
}

export async function getOrdersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

/** Get all paid orders whose review email is due (scheduledAt <= now, not yet sent) */
export async function getOrdersDueForReviewEmail() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "paid"),
        sql`${orders.reviewEmailSentAt} IS NULL`,
        sql`${orders.reviewEmailScheduledAt} IS NOT NULL`,
        sql`${orders.reviewEmailScheduledAt} <= ${now}`
      )
    );
}

// ─── Downloads ───────────────────────────────────────────────────────────────

export async function createDownloadsForOrder(orderId: number, productTier: "basic" | "premium") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Both Basic and Premium get the same PDF plans download.
  // Premium's extra value is the Captain Bob live chat (handled separately via chatEntitlements).
  const assets: InsertDownload[] = [
    {
      orderId,
      token: crypto.randomBytes(32).toString("hex"),
      assetType: "pdf_plans",
      displayName: productTier === "premium"
        ? "Premium Builder Plan Package (PDF)"
        : "Builder Plan Package (PDF)",
      fileSizeBytes: 4200000,
    },
  ];

  await db.insert(downloads).values(assets);
  return assets;
}

export async function getDownloadsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(downloads).where(eq(downloads.orderId, orderId));
}

export async function getDownloadByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(downloads).where(eq(downloads.token, token));
  return rows[0] ?? null;
}

export async function incrementDownloadCount(token: string) {
  const db = await getDb();
  if (!db) return;
  const row = await getDownloadByToken(token);
  if (!row) return;
  await db
    .update(downloads)
    .set({ downloadCount: row.downloadCount + 1 })
    .where(eq(downloads.token, token));
}

export async function getDownloadsForUser(userId: number) {
  const userOrders = await getOrdersByUserId(userId);
  const paidOrders = userOrders.filter((o) => o.status === "paid");
  const allDownloads = await Promise.all(
    paidOrders.map(async (order) => {
      const dl = await getDownloadsByOrderId(order.id);
      return dl.map((d) => ({ ...d, order }));
    })
  );
  return allDownloads.flat();
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function createReview(data: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviews).values(data);
  return (result as any)[0].insertId as number;
}

export async function updateReview(
  id: number,
  orderId: number,
  data: { rating: number; title?: string | null; body?: string | null; displayName?: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(reviews)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(reviews.id, id), eq(reviews.orderId, orderId)));
}

export async function deleteReview(id: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reviews).where(and(eq(reviews.id, id), eq(reviews.orderId, orderId)));
}

export async function getReviewsByProductTier(
  productTier: "basic" | "premium",
  limit = 20,
  offset = 0
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productTier, productTier), eq(reviews.isPublished, true)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getReviewByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.orderId, orderId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRatingStats(productTier: "basic" | "premium") {
  const db = await getDb();
  if (!db) return { averageRating: 0, totalReviews: 0, distribution: {} as Record<number, number> };

  const rows = await db
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.productTier, productTier), eq(reviews.isPublished, true)));

  if (rows.length === 0) {
    return { averageRating: 0, totalReviews: 0, distribution: {} as Record<number, number> };
  }

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const row of rows) {
    distribution[row.rating] = (distribution[row.rating] ?? 0) + 1;
    total += row.rating;
  }

  return {
    averageRating: Math.round((total / rows.length) * 10) / 10,
    totalReviews: rows.length,
    distribution,
  };
}

/** Verify that an orderId + guestReviewToken pair is valid and the order is paid */
export async function verifyOrderReviewToken(orderId: number, token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.guestReviewToken, token),
        eq(orders.status, "paid")
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

// ─── Chat Entitlements ────────────────────────────────────────────────────────

const CHAT_WINDOW_DAYS = 30;
const CHAT_MESSAGE_LIMIT = 1000;

/** Create a new chat entitlement for a Premium order (called at purchase confirmation) */
export async function createChatEntitlement(orderId: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHAT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const chatToken = crypto.randomBytes(32).toString("hex");

  const data: InsertChatEntitlement = {
    orderId,
    email,
    chatToken,
    startsAt: now,
    expiresAt,
    messageCount: 0,
    messageLimit: CHAT_MESSAGE_LIMIT,
    extensionCount: 0,
    status: "active",
  };

  const result = await db.insert(chatEntitlements).values(data);
  return { id: (result as any)[0].insertId as number, chatToken };
}

/** Look up an entitlement by its secure token */
export async function getEntitlementByToken(chatToken: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(chatEntitlements)
    .where(eq(chatEntitlements.chatToken, chatToken))
    .limit(1);
  return rows[0] ?? null;
}

/** Look up an entitlement by orderId */
export async function getEntitlementByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(chatEntitlements)
    .where(eq(chatEntitlements.orderId, orderId))
    .limit(1);
  return rows[0] ?? null;
}

/** Increment message count and auto-expire if over limit */
export async function incrementChatMessageCount(entitlementId: number, currentCount: number, limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const newCount = currentCount + 1;
  await db
    .update(chatEntitlements)
    .set({
      messageCount: newCount,
      ...(newCount >= limit ? { status: "expired" as const } : {}),
    })
    .where(eq(chatEntitlements.id, entitlementId));
}

/** Extend an entitlement by 30 more days and reset message count */
export async function extendChatEntitlement(entitlementId: number, currentExpiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If already expired (past date), extend from now; otherwise extend from current expiry
  const base = currentExpiresAt < new Date() ? new Date() : currentExpiresAt;
  const newExpiresAt = new Date(base.getTime() + CHAT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(chatEntitlements)
    .where(eq(chatEntitlements.id, entitlementId))
    .limit(1);
  const current = rows[0];
  if (!current) throw new Error("Entitlement not found");

  await db
    .update(chatEntitlements)
    .set({
      expiresAt: newExpiresAt,
      messageCount: 0,
      status: "active" as const,
      extensionCount: current.extensionCount + 1,
    })
    .where(eq(chatEntitlements.id, entitlementId));

  return newExpiresAt;
}

// ─── Chat Messages ────────────────────────────────────────────────────────────

/** Save a single chat message (user or assistant) */
export async function saveChatMessage(
  entitlementId: number,
  role: "user" | "assistant",
  content: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatMessages).values({ entitlementId, role, content });
  return (result as any)[0].insertId as number;
}

/** Retrieve the last N messages for context window (most recent first) */
export async function getChatHistory(entitlementId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.entitlementId, entitlementId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  // Return in chronological order for display
  return rows.reverse();
}
