import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

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

// TODO: add feature queries here as your schema grows.

// ─── Orders ──────────────────────────────────────────────────────────────────
import { desc } from "drizzle-orm";
import { orders, downloads, type InsertOrder, type InsertDownload } from "../drizzle/schema";
import crypto from "crypto";

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(data);
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
