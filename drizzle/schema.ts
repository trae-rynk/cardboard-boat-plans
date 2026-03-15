import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Orders table — records each purchase attempt and its status.
 * A successful order triggers creation of a download record.
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  /** Null for guest purchases (email-based delivery) */
  userId: int("userId"),
  /** Email used for purchase (for guest checkout and receipts) */
  email: varchar("email", { length: 320 }).notNull(),
  /** Product tier purchased */
  productTier: mysqlEnum("productTier", ["basic", "premium"]).notNull(),
  /** Amount in cents */
  amountCents: int("amountCents").notNull(),
  /** Stripe PaymentIntent ID */
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  /** Stripe client secret (temporary, used during checkout) */
  stripeClientSecret: varchar("stripeClientSecret", { length: 512 }),
  status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Downloads table — stores secure download tokens for purchased products.
 * Each token grants access to a specific file for a specific order.
 */
export const downloads = mysqlTable("downloads", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  /** Secure random token used in download URL */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** Type of downloadable asset */
  assetType: mysqlEnum("assetType", ["pdf_plans", "video_series", "design_hacks"]).notNull(),
  /** Display name shown in My Downloads */
  displayName: varchar("displayName", { length: 255 }).notNull(),
  /** File size in bytes for display */
  fileSizeBytes: int("fileSizeBytes"),
  /** Whether this download has been used */
  downloadCount: int("downloadCount").default(0).notNull(),
  /** Expiry — null means never expires */
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Download = typeof downloads.$inferSelect;
export type InsertDownload = typeof downloads.$inferInsert;
