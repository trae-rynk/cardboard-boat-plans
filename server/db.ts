import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  downloads,
  orders,
  reviews,
  users,
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
  const orderData: InsertOrder = {
    ...data,
    guestReviewToken: data.guestReviewToken ?? crypto.randomBytes(32).toString("hex"),
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

/** Get all paid orders that haven't had a review email sent yet and are at least 5 days old */
export async function getOrdersDueForReviewEmail() {
  const db = await getDb();
  if (!db) return [];
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "paid"),
        sql`${orders.reviewEmailSentAt} IS NULL`,
        sql`${orders.createdAt} <= ${fiveDaysAgo}`
      )
    );
}

// ─── Downloads ───────────────────────────────────────────────────────────────

export async function createDownloadsForOrder(orderId: number, productTier: "basic" | "premium") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const assets: InsertDownload[] = [
    {
      orderId,
      token: crypto.randomBytes(32).toString("hex"),
      assetType: "pdf_plans",
      displayName: "Complete Cardboard Boat Plans (PDF)",
      fileSizeBytes: 4200000,
    },
  ];

  if (productTier === "premium") {
    assets.push(
      {
        orderId,
        token: crypto.randomBytes(32).toString("hex"),
        assetType: "video_series",
        displayName: "Video Tutorial Series (6 Videos)",
        fileSizeBytes: 850000000,
      },
      {
        orderId,
        token: crypto.randomBytes(32).toString("hex"),
        assetType: "design_hacks",
        displayName: "Advanced Design Hacks Guide (PDF)",
        fileSizeBytes: 2100000,
      }
    );
  }

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
