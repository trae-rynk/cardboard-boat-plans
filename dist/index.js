// server/_core/index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var orders = mysqlTable("orders", {
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
  /**
   * Secure token that allows the purchaser to submit a review without signing in.
   * Generated at order creation, sent in the follow-up review email.
   */
  guestReviewToken: varchar("guestReviewToken", { length: 128 }),
  /** Timestamp when the 5-day follow-up review email was sent (null = not yet sent) */
  reviewEmailSentAt: timestamp("reviewEmailSentAt"),
  /** Timestamp when the review email is scheduled to be sent (createdAt + 5 days) */
  reviewEmailScheduledAt: timestamp("reviewEmailScheduledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var downloads = mysqlTable("downloads", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  /** The order that qualifies this review as a verified purchase */
  orderId: int("orderId").notNull(),
  /** Email of the reviewer (from the order) */
  email: varchar("email", { length: 320 }).notNull(),
  /** Which product tier is being reviewed */
  productTier: mysqlEnum("productTier", ["basic", "premium"]).notNull(),
  /** Star rating 1–5 */
  rating: int("rating").notNull(),
  /** Optional written review title */
  title: varchar("title", { length: 120 }),
  /** Optional written review body */
  body: text("body"),
  /** Display name shown on the review (buyer can choose what name to show) */
  displayName: varchar("displayName", { length: 100 }),
  /** Whether the review is visible publicly */
  isPublished: boolean("isPublished").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var chatEntitlements = mysqlTable("chatEntitlements", {
  id: int("id").autoincrement().primaryKey(),
  /** The original Premium order that created this entitlement */
  orderId: int("orderId").notNull(),
  /** Customer email (from the order) */
  email: varchar("email", { length: 320 }).notNull(),
  /** Token used to authenticate chat requests (same as guestReviewToken pattern) */
  chatToken: varchar("chatToken", { length: 128 }).notNull().unique(),
  /** When the current window started */
  startsAt: timestamp("startsAt").notNull(),
  /** When the current window expires (startsAt + 30 days, extended on renewal) */
  expiresAt: timestamp("expiresAt").notNull(),
  /** Total messages sent in the current window */
  messageCount: int("messageCount").default(0).notNull(),
  /** Max messages allowed per window */
  messageLimit: int("messageLimit").default(1e3).notNull(),
  /** Number of 30-day extensions purchased */
  extensionCount: int("extensionCount").default(0).notNull(),
  status: mysqlEnum("status", ["active", "expired", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  entitlementId: int("entitlementId").notNull(),
  /** 'user' = customer message, 'assistant' = Captain Bob reply */
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
import crypto from "crypto";
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createOrder(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1e3);
  const orderData = {
    ...data,
    guestReviewToken: data.guestReviewToken ?? crypto.randomBytes(32).toString("hex"),
    reviewEmailScheduledAt: data.reviewEmailScheduledAt ?? fiveDaysFromNow
  };
  const result = await db.insert(orders).values(orderData);
  return result[0].insertId;
}
async function getOrderById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orders).where(eq(orders.id, id));
  return rows[0] ?? null;
}
async function getOrderByStripePaymentIntentId(stripePaymentIntentId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orders).where(eq(orders.stripePaymentIntentId, stripePaymentIntentId));
  return rows[0] ?? null;
}
async function updateOrderStatus(id, status, stripePaymentIntentId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ status, ...stripePaymentIntentId ? { stripePaymentIntentId } : {} }).where(eq(orders.id, id));
}
async function markReviewEmailSent(orderId) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ reviewEmailSentAt: /* @__PURE__ */ new Date() }).where(eq(orders.id, orderId));
}
async function getOrdersByUserId(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}
async function getOrdersDueForReviewEmail() {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  return db.select().from(orders).where(
    and(
      eq(orders.status, "paid"),
      sql`${orders.reviewEmailSentAt} IS NULL`,
      sql`${orders.reviewEmailScheduledAt} IS NOT NULL`,
      sql`${orders.reviewEmailScheduledAt} <= ${now}`
    )
  );
}
async function createDownloadsForOrder(orderId, productTier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const assets = [
    {
      orderId,
      token: crypto.randomBytes(32).toString("hex"),
      assetType: "pdf_plans",
      displayName: productTier === "premium" ? "Premium Builder Plan Package (PDF)" : "Builder Plan Package (PDF)",
      fileSizeBytes: 42e5
    }
  ];
  await db.insert(downloads).values(assets);
  return assets;
}
async function getDownloadsByOrderId(orderId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(downloads).where(eq(downloads.orderId, orderId));
}
async function getDownloadByToken(token) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(downloads).where(eq(downloads.token, token));
  return rows[0] ?? null;
}
async function incrementDownloadCount(token) {
  const db = await getDb();
  if (!db) return;
  const row = await getDownloadByToken(token);
  if (!row) return;
  await db.update(downloads).set({ downloadCount: row.downloadCount + 1 }).where(eq(downloads.token, token));
}
async function getDownloadsForUser(userId) {
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
async function createReview(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviews).values(data);
  return result[0].insertId;
}
async function updateReview(id, orderId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reviews).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(reviews.id, id), eq(reviews.orderId, orderId)));
}
async function deleteReview(id, orderId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reviews).where(and(eq(reviews.id, id), eq(reviews.orderId, orderId)));
}
async function getReviewsByProductTier(productTier, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(and(eq(reviews.productTier, productTier), eq(reviews.isPublished, true))).orderBy(desc(reviews.createdAt)).limit(limit).offset(offset);
}
async function getReviewByOrderId(orderId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(reviews).where(eq(reviews.orderId, orderId)).limit(1);
  return rows[0] ?? null;
}
async function getRatingStats(productTier) {
  const db = await getDb();
  if (!db) return { averageRating: 0, totalReviews: 0, distribution: {} };
  const rows = await db.select({ rating: reviews.rating }).from(reviews).where(and(eq(reviews.productTier, productTier), eq(reviews.isPublished, true)));
  if (rows.length === 0) {
    return { averageRating: 0, totalReviews: 0, distribution: {} };
  }
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const row of rows) {
    distribution[row.rating] = (distribution[row.rating] ?? 0) + 1;
    total += row.rating;
  }
  return {
    averageRating: Math.round(total / rows.length * 10) / 10,
    totalReviews: rows.length,
    distribution
  };
}
async function verifyOrderReviewToken(orderId, token) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orders).where(
    and(
      eq(orders.id, orderId),
      eq(orders.guestReviewToken, token),
      eq(orders.status, "paid")
    )
  ).limit(1);
  return rows[0] ?? null;
}
var CHAT_WINDOW_DAYS = 30;
var CHAT_MESSAGE_LIMIT = 1e3;
async function createChatEntitlement(orderId, email) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + CHAT_WINDOW_DAYS * 24 * 60 * 60 * 1e3);
  const chatToken = crypto.randomBytes(32).toString("hex");
  const data = {
    orderId,
    email,
    chatToken,
    startsAt: now,
    expiresAt,
    messageCount: 0,
    messageLimit: CHAT_MESSAGE_LIMIT,
    extensionCount: 0,
    status: "active"
  };
  const result = await db.insert(chatEntitlements).values(data);
  return { id: result[0].insertId, chatToken };
}
async function getEntitlementByToken(chatToken) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(chatEntitlements).where(eq(chatEntitlements.chatToken, chatToken)).limit(1);
  return rows[0] ?? null;
}
async function getEntitlementByOrderId(orderId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(chatEntitlements).where(eq(chatEntitlements.orderId, orderId)).limit(1);
  return rows[0] ?? null;
}
async function incrementChatMessageCount(entitlementId, currentCount, limit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const newCount = currentCount + 1;
  await db.update(chatEntitlements).set({
    messageCount: newCount,
    ...newCount >= limit ? { status: "expired" } : {}
  }).where(eq(chatEntitlements.id, entitlementId));
}
async function extendChatEntitlement(entitlementId, currentExpiresAt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const base = currentExpiresAt < /* @__PURE__ */ new Date() ? /* @__PURE__ */ new Date() : currentExpiresAt;
  const newExpiresAt = new Date(base.getTime() + CHAT_WINDOW_DAYS * 24 * 60 * 60 * 1e3);
  const rows = await db.select().from(chatEntitlements).where(eq(chatEntitlements.id, entitlementId)).limit(1);
  const current = rows[0];
  if (!current) throw new Error("Entitlement not found");
  await db.update(chatEntitlements).set({
    expiresAt: newExpiresAt,
    messageCount: 0,
    status: "active",
    extensionCount: current.extensionCount + 1
  }).where(eq(chatEntitlements.id, entitlementId));
  return newExpiresAt;
}
async function saveChatMessage(entitlementId, role, content) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatMessages).values({ entitlementId, role, content });
  return result[0].insertId;
}
async function getChatHistory(entitlementId, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(chatMessages).where(eq(chatMessages.entitlementId, entitlementId)).orderBy(desc(chatMessages.createdAt)).limit(limit);
  return rows.reverse();
}

// server/_core/cookies.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isIpAddress(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getParentDomain(hostname) {
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return void 0;
  }
  const parts = hostname.split(".");
  if (parts.length < 3) {
    return void 0;
  }
  return "." + parts.slice(-2).join(".");
}
function getSessionCookieOptions(req) {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);
  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(EXCHANGE_TOKEN_PATH, payload);
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(GET_USER_INFO_PATH, {
      accessToken: token.accessToken
    });
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(platforms.filter((p) => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
async function syncUser(userInfo) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }
  const lastSignedIn = /* @__PURE__ */ new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return saved ?? {
    openId: userInfo.openId,
    name: userInfo.name,
    email: userInfo.email,
    loginMethod: userInfo.loginMethod ?? null,
    lastSignedIn
  };
}
function buildUserResponse(user) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? /* @__PURE__ */ new Date()).toISOString()
  };
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      const frontendUrl = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PACKAGER_PROXY_URL || "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
  app.get("/api/oauth/mobile", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user)
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });
  app.post("/api/auth/session", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("webdevtoken.v1.WebDevService/SendNotification", normalizedBase).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
async function getStripe() {
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // ─── Orders ────────────────────────────────────────────────────────────────
  orders: router({
    /**
     * Create a Stripe PaymentIntent and a pending order record.
     * Returns the client secret needed by the frontend to confirm payment.
     */
    createPaymentIntent: publicProcedure.input(
      z2.object({
        productTier: z2.enum(["basic", "premium"]),
        email: z2.string().email()
      })
    ).mutation(async ({ ctx, input }) => {
      const PRICES = { basic: 1999, premium: 3999 };
      const amountCents = PRICES[input.productTier];
      let clientSecret = null;
      let stripePaymentIntentId = null;
      try {
        const stripe = await getStripe();
        const intent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "usd",
          receipt_email: input.email,
          metadata: {
            productTier: input.productTier,
            email: input.email
          }
        });
        clientSecret = intent.client_secret;
        stripePaymentIntentId = intent.id;
      } catch (err) {
        console.warn("[Stripe] Not configured, creating demo order:", err);
      }
      const orderId = await createOrder({
        userId: ctx.user?.id ?? null,
        email: input.email,
        productTier: input.productTier,
        amountCents,
        stripePaymentIntentId: stripePaymentIntentId ?? void 0,
        stripeClientSecret: clientSecret ?? void 0,
        status: "pending"
      });
      return {
        orderId,
        clientSecret,
        stripePaymentIntentId,
        amountCents,
        stripeConfigured: !!process.env.STRIPE_SECRET_KEY
      };
    }),
    /**
     * Confirm a payment (called after Stripe confirms on the client).
     * Marks the order as paid, creates download tokens, and schedules the
     * 5-day review follow-up email.
     */
    confirmPayment: publicProcedure.input(
      z2.object({
        orderId: z2.number(),
        stripePaymentIntentId: z2.string().optional()
      })
    ).mutation(async ({ input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new Error("Order not found");
      if (process.env.STRIPE_SECRET_KEY && input.stripePaymentIntentId) {
        const stripe = await getStripe();
        const intent = await stripe.paymentIntents.retrieve(input.stripePaymentIntentId);
        if (intent.status !== "succeeded") {
          throw new Error(`Payment not completed: ${intent.status}`);
        }
      }
      await updateOrderStatus(order.id, "paid", input.stripePaymentIntentId);
      const downloads2 = await createDownloadsForOrder(order.id, order.productTier);
      sendOrderConfirmationEmail({
        orderId: order.id,
        email: order.email,
        productTier: order.productTier
      }).catch((err) => console.warn("[ConfirmEmail] Failed to send:", err));
      scheduleReviewEmail(order.id, order.email, order.productTier, order.guestReviewToken ?? "").catch(
        (err) => console.warn("[ReviewEmail] Failed to schedule:", err)
      );
      let chatToken;
      if (order.productTier === "premium") {
        try {
          const entitlement = await createChatEntitlement(order.id, order.email);
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
        downloads: downloads2.map((d) => ({
          token: d.token,
          displayName: d.displayName,
          assetType: d.assetType,
          fileSizeBytes: d.fileSizeBytes
        }))
      };
    }),
    /**
     * Get all orders for the currently logged-in user.
     */
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      return getOrdersByUserId(ctx.user.id);
    }),
    /**
     * Get order by ID (public — used after purchase to show confirmation).
     * Returns the guestReviewToken so the app can open the review modal.
     */
    getOrder: publicProcedure.input(z2.object({ orderId: z2.number() })).query(async ({ input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) return null;
      return order;
    })
  }),
  // ─── Reviews ──────────────────────────────────────────────────────────────
  reviews: router({
    /**
     * Submit a new review (or update an existing one).
     * No sign-in required — verified by orderId + guestReviewToken.
     * Works for all SKUs.
     */
    submit: publicProcedure.input(
      z2.object({
        orderId: z2.number(),
        guestReviewToken: z2.string(),
        rating: z2.number().int().min(1).max(5),
        title: z2.string().max(120).optional(),
        body: z2.string().max(2e3).optional(),
        displayName: z2.string().max(100).optional()
      })
    ).mutation(async ({ input }) => {
      const order = await verifyOrderReviewToken(input.orderId, input.guestReviewToken);
      if (!order) {
        throw new Error("Invalid order or review token. Please use the link from your purchase confirmation.");
      }
      const existing = await getReviewByOrderId(input.orderId);
      if (existing) {
        await updateReview(existing.id, input.orderId, {
          rating: input.rating,
          title: input.title ?? null,
          body: input.body ?? null,
          displayName: input.displayName ?? null
        });
        return { reviewId: existing.id, action: "updated" };
      } else {
        const reviewId = await createReview({
          orderId: input.orderId,
          email: order.email,
          productTier: order.productTier,
          rating: input.rating,
          title: input.title ?? null,
          body: input.body ?? null,
          displayName: input.displayName ?? null
        });
        return { reviewId, action: "created" };
      }
    }),
    /**
     * Delete a review by orderId + guestReviewToken (no auth required).
     */
    delete: publicProcedure.input(z2.object({ reviewId: z2.number(), orderId: z2.number(), guestReviewToken: z2.string() })).mutation(async ({ input }) => {
      const order = await verifyOrderReviewToken(input.orderId, input.guestReviewToken);
      if (!order) throw new Error("Invalid order or review token.");
      await deleteReview(input.reviewId, input.orderId);
      return { success: true };
    }),
    /**
     * List published reviews for a product tier (public).
     */
    list: publicProcedure.input(
      z2.object({
        productTier: z2.enum(["basic", "premium"]),
        limit: z2.number().int().min(1).max(50).default(10),
        offset: z2.number().int().min(0).default(0)
      })
    ).query(async ({ input }) => {
      return getReviewsByProductTier(input.productTier, input.limit, input.offset);
    }),
    /**
     * Get rating stats (average, count, distribution) for a product tier.
     */
    stats: publicProcedure.input(z2.object({ productTier: z2.enum(["basic", "premium"]) })).query(async ({ input }) => {
      return getRatingStats(input.productTier);
    }),
    /**
     * Get the review for a specific order (by orderId + guestReviewToken).
     * No auth required.
     */
    myReview: publicProcedure.input(z2.object({ orderId: z2.number(), guestReviewToken: z2.string() })).query(async ({ input }) => {
      const order = await verifyOrderReviewToken(input.orderId, input.guestReviewToken);
      if (!order) return null;
      return getReviewByOrderId(input.orderId);
    })
  }),
  // ─── Downloads ─────────────────────────────────────────────────────────────
  downloads: router({
    /**
     * Get all downloads for a specific order (by orderId).
     */
    forOrder: publicProcedure.input(z2.object({ orderId: z2.number() })).query(async ({ input }) => {
      const order = await getOrderById(input.orderId);
      if (!order || order.status !== "paid") return [];
      return getDownloadsByOrderId(input.orderId);
    }),
    /**
     * Get downloads for a list of orderIds (guest access — no auth required).
     * Used by the Downloads tab when the customer hasn't signed in.
     */
    forOrders: publicProcedure.input(z2.object({ orderIds: z2.array(z2.number()).max(10) })).query(async ({ input }) => {
      if (input.orderIds.length === 0) return [];
      const results = await Promise.all(
        input.orderIds.map(async (orderId) => {
          const order = await getOrderById(orderId);
          if (!order || order.status !== "paid") return [];
          const dls = await getDownloadsByOrderId(orderId);
          return dls.map((d) => ({ ...d, order }));
        })
      );
      return results.flat();
    }),
    /**
     * Recover a purchase on a new device.
     * Verifies email + orderId, returns the order's downloads and chatToken (if Premium).
     * This is the unified cross-device recovery endpoint used by both the Downloads tab
     * and the Captain Bob gate screen.
     */
    recoverPurchase: publicProcedure.input(z2.object({ orderId: z2.number(), email: z2.string().email() })).mutation(async ({ input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new Error("Order not found. Please check your order number.");
      if (order.status !== "paid") throw new Error("This order has not been completed.");
      if (order.email.toLowerCase() !== input.email.toLowerCase().trim()) {
        throw new Error("The email address does not match this order. Please check and try again.");
      }
      const downloads2 = await getDownloadsByOrderId(order.id);
      let chatToken = null;
      if (order.productTier === "premium") {
        const entitlement = await getEntitlementByOrderId(order.id);
        chatToken = entitlement?.chatToken ?? null;
      }
      return {
        orderId: order.id,
        productTier: order.productTier,
        downloads: downloads2,
        chatToken
      };
    }),
    /**
     * Get all downloads for the logged-in user across all their orders.
     */
    myDownloads: protectedProcedure.query(async ({ ctx }) => {
      return getDownloadsForUser(ctx.user.id);
    }),
    /**
     * Resolve a download token to a file URL.
     */
    resolveToken: publicProcedure.input(z2.object({ token: z2.string() })).query(async ({ input }) => {
      const download = await getDownloadByToken(input.token);
      if (!download) throw new Error("Invalid download token");
      if (download.expiresAt && /* @__PURE__ */ new Date() > download.expiresAt) {
        throw new Error("Download link has expired");
      }
      await incrementDownloadCount(input.token);
      const PLACEHOLDER_URLS = {
        pdf_plans: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663440726246/ffmRMeRiboUTqtrm.pdf",
        video_series: "https://example.com/video-series",
        design_hacks: "https://example.com/design-hacks"
      };
      return {
        url: PLACEHOLDER_URLS[download.assetType] ?? "#",
        displayName: download.displayName,
        assetType: download.assetType
      };
    })
  }),
  // ─── Captain Bob Chat ───────────────────────────────────────────────────────────
  chat: router({
    /**
     * Get the chat entitlement status for a Premium order.
     * Returns days remaining, messages remaining, and active status.
     */
    getEntitlement: publicProcedure.input(z2.object({ orderId: z2.number(), chatToken: z2.string() })).query(async ({ input }) => {
      const entitlement = await getEntitlementByToken(input.chatToken);
      if (!entitlement || entitlement.orderId !== input.orderId) return null;
      const now = /* @__PURE__ */ new Date();
      const isExpiredByDate = entitlement.expiresAt < now;
      const isExpiredByCount = entitlement.messageCount >= entitlement.messageLimit;
      const isActive = entitlement.status === "active" && !isExpiredByDate && !isExpiredByCount;
      const msRemaining = Math.max(0, entitlement.expiresAt.getTime() - now.getTime());
      const daysRemaining = Math.ceil(msRemaining / (1e3 * 60 * 60 * 24));
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
        status: isExpiredByDate || isExpiredByCount ? "expired" : entitlement.status
      };
    }),
    /**
     * Get the last 50 messages for a chat session.
     */
    getHistory: publicProcedure.input(z2.object({ orderId: z2.number(), chatToken: z2.string() })).query(async ({ input }) => {
      const entitlement = await getEntitlementByToken(input.chatToken);
      if (!entitlement || entitlement.orderId !== input.orderId) return [];
      return getChatHistory(entitlement.id, 50);
    }),
    /**
     * Send a message to Captain Bob and get a reply.
     * Enforces message cap and expiry window.
     */
    sendMessage: publicProcedure.input(
      z2.object({
        orderId: z2.number(),
        chatToken: z2.string(),
        message: z2.string().min(1).max(1e3)
      })
    ).mutation(async ({ input }) => {
      const entitlement = await getEntitlementByToken(input.chatToken);
      if (!entitlement || entitlement.orderId !== input.orderId) {
        throw new Error("Invalid chat token.");
      }
      if (entitlement.expiresAt < /* @__PURE__ */ new Date()) {
        throw new Error("EXPIRED: Your 30-day support window has ended.");
      }
      if (entitlement.messageCount >= entitlement.messageLimit) {
        throw new Error("LIMIT_REACHED: You have used all 1,000 messages in this support window.");
      }
      await saveChatMessage(entitlement.id, "user", input.message);
      const history = await getChatHistory(entitlement.id, 20);
      const historyForAI = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const reply = await captainBobReply(input.message, historyForAI);
      await saveChatMessage(entitlement.id, "assistant", reply);
      await incrementChatMessageCount(
        entitlement.id,
        entitlement.messageCount,
        entitlement.messageLimit
      );
      return {
        reply,
        messagesRemaining: Math.max(0, entitlement.messageLimit - entitlement.messageCount - 1)
      };
    }),
    /**
     * Purchase a 30-day extension for $9.99.
     * Creates a Stripe PaymentIntent for the extension SKU.
     */
    createExtensionIntent: publicProcedure.input(z2.object({ orderId: z2.number(), chatToken: z2.string(), email: z2.string().email() })).mutation(async ({ input }) => {
      const entitlement = await getEntitlementByToken(input.chatToken);
      if (!entitlement || entitlement.orderId !== input.orderId) {
        throw new Error("Invalid chat token.");
      }
      const EXTENSION_PRICE_CENTS = 999;
      let clientSecret = null;
      let stripePaymentIntentId = null;
      try {
        const stripe = await getStripe();
        const intent = await stripe.paymentIntents.create({
          amount: EXTENSION_PRICE_CENTS,
          currency: "usd",
          receipt_email: input.email,
          metadata: {
            type: "chat_extension",
            entitlementId: String(entitlement.id),
            orderId: String(input.orderId)
          }
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
        stripeConfigured: !!process.env.STRIPE_SECRET_KEY
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
    devUnlock: publicProcedure.mutation(async () => {
      if (process.env.NODE_ENV === "production") {
        throw new Error("devUnlock is not available in production.");
      }
      const orderId = await createOrder({
        email: "dev-test@example.com",
        productTier: "premium",
        amountCents: 3999,
        status: "paid",
        stripePaymentIntentId: "dev_test_" + Date.now()
      });
      const { chatToken } = await createChatEntitlement(orderId, "dev-test@example.com");
      return { orderId, chatToken };
    }),
    /**
     * Restore Captain Bob access on a new device.
     * Verifies that the provided email matches a paid Premium order with the given orderId,
     * then returns the existing chatToken so it can be saved locally.
     * Rate-limited by checking order status only — no brute-force risk since orderId + email
     * must both match exactly.
     */
    restoreChatAccess: publicProcedure.input(z2.object({ orderId: z2.number(), email: z2.string().email() })).mutation(async ({ input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new Error("Order not found. Please check your order number.");
      if (order.status !== "paid") throw new Error("This order has not been completed.");
      if (order.productTier !== "premium") throw new Error("Captain Bob is only available with the Premium package.");
      if (order.email.toLowerCase() !== input.email.toLowerCase().trim()) {
        throw new Error("The email address does not match this order. Please check and try again.");
      }
      const entitlement = await getEntitlementByOrderId(order.id);
      if (!entitlement) throw new Error("No Captain Bob entitlement found for this order. Please contact support.");
      return {
        orderId: order.id,
        chatToken: entitlement.chatToken,
        isActive: entitlement.status === "active" && entitlement.expiresAt > /* @__PURE__ */ new Date()
      };
    }),
    confirmExtension: publicProcedure.input(
      z2.object({
        orderId: z2.number(),
        chatToken: z2.string(),
        stripePaymentIntentId: z2.string().optional()
      })
    ).mutation(async ({ input }) => {
      const entitlement = await getEntitlementByToken(input.chatToken);
      if (!entitlement || entitlement.orderId !== input.orderId) {
        throw new Error("Invalid chat token.");
      }
      if (process.env.STRIPE_SECRET_KEY && input.stripePaymentIntentId) {
        const stripe = await getStripe();
        const intent = await stripe.paymentIntents.retrieve(input.stripePaymentIntentId);
        if (intent.status !== "succeeded") {
          throw new Error(`Extension payment not completed: ${intent.status}`);
        }
      }
      const newExpiresAt = await extendChatEntitlement(entitlement.id, entitlement.expiresAt);
      return {
        success: true,
        newExpiresAt: newExpiresAt.toISOString(),
        extensionCount: entitlement.extensionCount + 1
      };
    })
  })
});
async function captainBobReply(userMessage, history) {
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const SYSTEM_PROMPT = `You are Captain Bob, the expert support assistant for Champion Cardboard Boats \u2014 an 8-time cardboard boat racing champion. You help customers who have purchased the Champion Cardboard Boat building plans. You are the authoritative source on THIS specific design only. Do not suggest alternative designs, generic boat-building advice that contradicts these plans, or techniques not described here. If a question falls outside the scope of these plans, say so honestly and redirect.

## THE DESIGN PHILOSOPHY
The Champion Cardboard Boat uses a wine-box skeleton engineering principle. The interior skeleton panels interlock and lock together, creating a rigid cage. The outer shell (top, bottom, side panels) then contains and reinforces that cage. This is what allows the boat to handle water pressure without collapsing \u2014 the reason most other cardboard boats fail. The skeleton MUST be built correctly or the outer panels will not fit properly.

## MATERIALS
- Cardboard: Double-wall corrugated is strongly recommended. Single-wall can be used for interior bracing panels but NOT for the hull or center spines. Any large shipping boxes work \u2014 appliance boxes, furniture boxes, moving boxes.
- Tools: Utility knife / box cutter (keep blades sharp \u2014 dull blades cause rough cuts), straight edge / ruler, marker or pencil, tape measure.
- Tape: Duct tape for all seams and reinforcement.
- Paint: Exterior latex paint (minimum 3 coats). Optional but recommended: Kilz exterior primer as underbase (2 coats).
- Do NOT use: 2-part epoxy (banned at most races). Do NOT wrap the entire boat in duct tape (banned at most races).

## WHERE TO GET FREE CARDBOARD BOXES
- Check neighborhood Facebook groups \u2014 people moving always have boxes to give away.
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
- Top Panel: Qty 1 (22" x 35", cockpit cutout 18" x 30" \u2014 KEEP THE CUTOUT for cockpit floor)
- Bottom Panel: Qty 1 (22" x 35", bow section 30.5")
- Bow Side Panels: Qty 2 mirrored (triangle, 28.625" top edge, 31" long side, 8.5" tall)
- Stern Side Panels: Qty 2 mirrored (triangle, 9 7/8" edges, 8.5" tall)

## STEP-BY-STEP BUILD INSTRUCTIONS

### STEP 1 \u2014 BUILD INTERNAL SKELETON (most critical step)
This step determines the final shape of the entire boat. Do not rush it.
1. Lay both Center Spine Panels flat and parallel to each other.
2. Insert Internal Panels in this exact order: A \u2192 A \u2192 B \u2192 B \u2192 B \u2192 B \u2192 A \u2192 A
   ("A" panels at both ends, "B" panels in the center)
3. Ensure each panel is fully seated into the spine slots. Work from the center outward.
4. Insert the Side Support Rails into the matching slots on each internal panel. This locks the width of the boat.
5. Install Cockpit Side Walls (30" x 6", no slots) \u2014 one on each side of the cockpit area, parallel to the center spines, sitting level on the internal supports, centered left-to-right.
6. DO NOT TAPE YET \u2014 keep everything adjustable until the full dry fit is complete.
Alignment check (ALL must pass before taping):
- All cockpit panels are level and parallel
- Structure is symmetrical left to right
- All internal panels are perpendicular to the center spines
- No twisting or leaning
- All panels fully seated in slots
Once alignment is confirmed, tape all slot connections on both sides of each joint. Reinforce high-stress areas at spine intersections.
COMMON MISTAKES: Forcing slots together, taping before checking alignment, uneven panel spacing, twisted or leaning structure.

### STEP 2 \u2014 ADD BOW & STERN SUPPORTS
1. Insert the Bow Support Middle Panel into the forward diagonal slots of the center spines.
2. Insert the Stern Support Middle Panel into the rear slots of the center spines.
3. Both panels must be fully seated and centered. Do not tape yet.
Alignment check: Both panels centered, no gaps at slot connections, panels aligned with center spines, no leaning or twisting.
Note: The stern is the back of the boat. The bow is the front.

### STEP 3 \u2014 ATTACH BOTTOM PANEL
This step locks the entire skeleton into final position.
1. Align the Bottom Panel (22" x 35") with the skeleton \u2014 it must contact all ribs and supports.
2. Tape along all seams starting from the center outward.
Alignment check: Panel sits flush across all ribs, no visible gaps, edges align with frame, structure remains square, no bowing or warping.
Do not tape until alignment is confirmed.

### STEP 4 \u2014 ATTACH TOP PANEL
CRITICAL: Cut the 18" x 30" cockpit opening BEFORE installing the top panel. KEEP the cutout piece \u2014 it becomes the cockpit floor.
1. Align the Top Panel (22" x 35") with the structure.
2. Ensure proper fit at bow and stern.
3. Tape along all edges and seams. Triple-tape the connection between the top and bottom panels.
Alignment check: Top panel flush along all edges, cockpit opening clean and centered, no gaps along seams, structure remains square.

### STEP 5 \u2014 CREATE & ATTACH SIDE PANELS
Recommended method (trace method \u2014 easier than measuring angles):
1. Place a large sheet of cardboard against one side of the boat, hold flush, and trace the opening.
2. Cut and test fit. Trim as needed.
3. Use the first cut panel as a template for the second (mirrored) panel.
4. Tape along all edges where panels meet the structure. Use continuous tape runs.
Note: Small gaps are OK \u2014 taped edges will hide minor imperfections.
For bow and stern side panels: You can also build the rest of the boat first, then overlay cardboard over each area to sketch the edges and cut to shape (much easier than measuring the angles).

### STEP 6 \u2014 WATERPROOFING & FINAL REINFORCEMENT
Seam sealing:
1. Inspect ALL seams across the entire boat.
2. Apply duct tape to all joints \u2014 maximum 3 layers. Focus on: bottom panel seams, side panel edges, bow/stern transitions, cockpit edges.
3. DO NOT wrap the entire boat in tape \u2014 tape is for seams and reinforcement only. Most races ban full-tape coverage.
Paint application:
1. Optional but strongly recommended: Apply 2 coats of Kilz exterior primer. Let each coat dry fully.
2. Apply exterior latex paint \u2014 minimum 3 coats. Cover bottom panel, seams, and edges completely. Let each coat dry before the next.
Final check: No exposed cardboard edges, all seams sealed, no visible gaps or openings, structure feels rigid when lifted, cockpit floor panel is secure.

## PANEL TEMPLATES \u2014 KEY DIMENSIONS
- Top/Bottom panels: Best cut from one large sheet (22" x 35"). If using smaller pieces, cut sections A\u2013E and duct tape together. Top panel cockpit cutout is 18" x 30" (keep it).
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
2. Seams in the center spines. If you must use smaller boxes, minimize seams \u2014 especially in the center spines (the front-to-back supports). Seams here weaken the entire structure.
3. Skipping or rushing waterproofing. Thin paint over bare cardboard is not enough. The Kilz primer step is essential for durability.
4. Over-taping the exterior. Taping the entire boat surface is banned at most races. Tape seams only.
5. Discarding the cockpit cutout. Keep it \u2014 it becomes the cockpit floor.

## COCKPIT CONSTRUCTION \u2014 DETAILED EXPLANATION
The cockpit is a recessed cavity in the top of the boat where the paddler sits. Here is exactly how it is constructed:
- The cockpit FLOOR is the 18" x 30" piece cut out from the top panel (Step 4). Keep this piece \u2014 it drops in as the floor of the cockpit cavity.
- The cockpit SIDE WALLS are the two 30" x 6" panels listed in the parts list. These have no slots. They are soft-inserted (placed in, not locked) in Step 1 alongside the internal skeleton, one on each side of the cockpit area, parallel to the center spines.
- The cockpit FRONT and BACK WALLS are the two innermost Panel A's. The four Panel A's are positioned at both ends of the skeleton (two at the bow end, two at the stern end). The two innermost A panels (closest to the center) form the front and back walls of the cockpit cavity.
- Panel B's (the four center panels) have a rectangular cutout on their top edge \u2014 this is what creates the open cockpit cavity. Panel B's are 34" x 12" with a rectangular center section (18" wide) and angled sides.
- Panel A's (at the ends) have no top cutout \u2014 they are solid hexagonal panels. The two innermost A's contain the cockpit front-to-back, and the two outermost A's form the bow and stern starting points of the hull shape.

Summary: The cockpit is a box formed by: Panel B cutouts on top (open cavity), cockpit side walls on the sides, the two innermost Panel A's front and back, and the cockpit floor panel dropped in from above.

## FREQUENTLY ASKED QUESTIONS
- **Where are the panel templates?** The panel templates are located in the back portion of the plans, after the assembly instruction pages. If a customer asks where to find the panel templates, panel diagrams, or cutting templates, direct them to the back section of their PDF after the step-by-step assembly pages.

## TONE & STYLE
You are friendly, encouraging, and practical. Use plain, clear English \u2014 no nautical slang, pirate speak, or sailing metaphors after your greeting. Do not use "Ahoy", "Arr", "matey", "sea legs", "landlubber", "set sail", "batten down", or similar phrases in your responses. Keep answers concise \u2014 3\u20135 sentences for simple questions, a short numbered list for multi-step processes. If someone asks about something unrelated to these specific plans or boat building, politely redirect. Always refer to yourself as Captain Bob. Never invent dimensions or steps not listed above \u2014 if unsure, tell the customer to refer to the specific page in their plans.`;
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage }
      ];
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 400,
        temperature: 0.7
      });
      return completion.choices[0]?.message?.content ?? "I ran into a technical issue. Please try sending your message again.";
    } catch (err) {
      console.error("[CaptainBob] OpenAI error:", err);
      return "I'm having a technical issue right now. Please try again in a moment.";
    }
  }
  const lower = userMessage.toLowerCase();
  if (lower.includes("waterproof") || lower.includes("seal")) {
    return "For waterproofing, triple-tape all exterior seams with duct tape, then apply 2 coats of Kilz exterior primer followed by at least 3 coats of exterior latex paint. Let each coat dry fully before the next. Pay extra attention to the bottom panel and bow \u2014 those areas take the most water pressure.";
  }
  if (lower.includes("tape") || lower.includes("duct")) {
    return "Standard duct tape works well for all seams and reinforcement. Triple-tape all exterior seams for best results. Most races do not allow you to tape the entire exterior surface \u2014 tape is for seams and joints only.";
  }
  if (lower.includes("cardboard") || lower.includes("material")) {
    return "Double-wall corrugated cardboard is strongly recommended, especially for the hull and center spines. Single-wall can work for interior bracing panels. Check neighborhood Facebook groups or appliance/furniture stores for free large boxes \u2014 they receive big shipments regularly.";
  }
  if (lower.includes("how long") || lower.includes("time") || lower.includes("weekend")) {
    return "Most builders complete the boat in one weekend \u2014 about 8-10 hours total. Day 1: cut and assemble the skeleton and panels. Day 2: tape all seams, apply primer and paint, and let it cure overnight. A quick float test before race day is a good idea.";
  }
  if (lower.includes("race") || lower.includes("competition") || lower.includes("win")) {
    return "Race day tips: (1) Keep your crew weight centered and low. (2) Practice your paddle stroke before the race. (3) Bring extra duct tape for last-minute repairs. (4) Many races score on showmanship \u2014 have fun with the crowd!";
  }
  return "Ahoy! I'm Captain Bob, your Champion Cardboard Boats support expert. I'm here to help you build a winning boat. Ask me anything about construction, materials, waterproofing, or race day. What would you like to know?";
}
async function scheduleReviewEmail(orderId, email, _productTier, _guestReviewToken) {
  console.log(`[ReviewEmail] Order #${orderId} (${email}) scheduled for review email in 5 days.`);
}
function startReviewEmailPoller() {
  const POLL_INTERVAL_MS = 60 * 60 * 1e3;
  async function poll() {
    if (!process.env.RESEND_API_KEY) return;
    try {
      const due = await getOrdersDueForReviewEmail();
      for (const order of due) {
        if (!order.guestReviewToken) continue;
        try {
          await sendReviewRequestEmail({
            orderId: order.id,
            email: order.email,
            productTier: order.productTier,
            guestReviewToken: order.guestReviewToken
          });
          await markReviewEmailSent(order.id);
          console.log(`[ReviewEmail] Sent review email for order #${order.id} (${order.email})`);
        } catch (err) {
          console.error(`[ReviewEmail] Failed to send for order #${order.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[ReviewEmail] Poller error:", err);
    }
  }
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
  console.log("[ReviewEmail] Poller started (interval: 1 hour).");
}
async function sendOrderConfirmationEmail({
  orderId,
  email,
  productTier
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[ConfirmEmail] RESEND_API_KEY not set \u2014 skipping confirmation email for order #${orderId}`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const isPremium = productTier === "premium";
  const productName = isPremium ? "Premium Builder Package" : "Builder Plan Package";
  const appUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://championcardboardboats.com";
  const bobSection = isPremium ? `
          <!-- Captain Bob Section -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border-radius:10px;border:1px solid #bfdbfe;padding:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;color:#1e3a5f;font-size:15px;font-weight:800;">\u2693 Captain Bob Chat Access</p>
                    <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">
                      Your Premium package includes 30 days of expert chat support with Captain Bob.
                      Open the app, go to the <strong>Captain Bob</strong> tab, and start chatting \u2014 your access is already unlocked.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : "";
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Order Confirmation</title>
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
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.3;">You're all set! \u{1F3C6}</h1>
            </td>
          </tr>
          <!-- Order Confirmed Banner -->
          <tr>
            <td style="background:#f59e0b;padding:14px 40px;text-align:center;">
              <p style="margin:0;color:#1e3a5f;font-size:14px;font-weight:800;letter-spacing:0.5px;">ORDER CONFIRMED \u2014 #${orderId}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 24px;">
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                Thank you for purchasing the <strong>${productName}</strong>. Your plans are ready to download right now.
              </p>
              <!-- Order Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#6b7280;font-size:13px;padding-bottom:8px;">Product</td>
                        <td style="color:#111827;font-size:13px;font-weight:700;text-align:right;padding-bottom:8px;">${productName}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;font-size:13px;padding-bottom:8px;">Order Number</td>
                        <td style="color:#111827;font-size:13px;font-weight:700;text-align:right;padding-bottom:8px;">#${orderId}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">Email</td>
                        <td style="color:#111827;font-size:13px;font-weight:700;text-align:right;">${email}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Download CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}"
                       style="display:inline-block;background:#f59e0b;color:#1e3a5f;font-size:16px;font-weight:800;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
                      \u{1F4C4} Download Your Plans
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${bobSection}
          <!-- Recovery Info -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:10px;border:1px solid #fde68a;padding:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;color:#92400e;font-size:14px;font-weight:800;">\u{1F4A1} Save This Email \u2014 Your Access Key</p>
                    <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">
                      If you switch devices or clear your browser, you can restore access to your plans anytime.
                      Open the app \u2192 <strong>My Downloads</strong> tab \u2192 tap <strong>Recover My Purchase</strong> \u2192 enter your email and order number <strong>#${orderId}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                \xA9 2026 Champion Cardboard Boats. All Rights Reserved.
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
    subject: `Your ${productName} is ready to download \u2014 Order #${orderId}`,
    html
  });
  console.log(`[ConfirmEmail] Sent order confirmation to ${email} for order #${orderId}`);
}
async function sendReviewRequestEmail({
  orderId,
  email,
  productTier,
  guestReviewToken
}) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const productName = productTier === "premium" ? "Premium Cardboard Boat Package" : "Builder Plan Package";
  const APP_SCHEME = process.env.EXPO_APP_SCHEME ?? "manus20260315120445";
  const webFallbackBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://championcardboardboats.com";
  const appDeepLink = `${APP_SCHEME}://write-review?orderId=${orderId}&token=${guestReviewToken}`;
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
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.3;">How did your build go? \u{1F3C6}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                Hi there,
              </p>
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                It's been 5 days since you downloaded the <strong>${productName}</strong> \u2014 we hope your build is coming along great!
              </p>
              <p style="margin:0 0 32px;color:#374151;font-size:16px;line-height:1.6;">
                We'd love to hear how it went. Your review helps other builders decide if these plans are right for them \u2014 and it only takes 30 seconds.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${reviewUrl}"
                       style="display:inline-block;background:#f59e0b;color:#1e3a5f;font-size:16px;font-weight:800;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
                      \u2B50 Rate Your Experience
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
                \xA9 2026 Champion Cardboard Boats. All Rights Reserved.
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
    subject: `How did your ${productName} build go? \u2B50`,
    html
  });
}

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/webhook.ts
async function getStripe2() {
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}
async function fulfillOrder(orderId, stripePaymentIntentId) {
  const order = await getOrderById(orderId);
  if (!order) {
    console.warn(`[Webhook] Order #${orderId} not found`);
    return;
  }
  if (order.status === "paid") {
    console.log(`[Webhook] Order #${orderId} already fulfilled, skipping`);
    return;
  }
  await updateOrderStatus(order.id, "paid", stripePaymentIntentId);
  await createDownloadsForOrder(order.id, order.productTier);
  sendOrderConfirmationEmail({
    orderId: order.id,
    email: order.email,
    productTier: order.productTier
  }).catch((err) => console.warn("[Webhook] Failed to send confirmation email:", err));
  scheduleReviewEmail(
    order.id,
    order.email,
    order.productTier,
    order.guestReviewToken ?? ""
  ).catch((err) => console.warn("[Webhook] Failed to schedule review email:", err));
  if (order.productTier === "premium") {
    try {
      await createChatEntitlement(order.id, order.email);
    } catch (err) {
      console.warn(`[Webhook] Failed to create chat entitlement for order #${order.id}:`, err);
    }
  }
  console.log(`[Webhook] Order #${orderId} fulfilled successfully`);
}
async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[Webhook] STRIPE_WEBHOOK_SECRET not set \u2014 skipping signature verification");
    res.status(400).json({ error: "Webhook secret not configured" });
    return;
  }
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }
  let event;
  try {
    const stripe = await getStripe2();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
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
        const metadata = intent.metadata;
        const order = await getOrderByStripePaymentIntentId(stripePaymentIntentId);
        if (order) {
          await fulfillOrder(order.id, stripePaymentIntentId);
        } else {
          console.warn(
            `[Webhook] No order found for PaymentIntent ${stripePaymentIntentId}`,
            "metadata:",
            metadata
          );
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        const stripePaymentIntentId = intent.id;
        const failureMessage = intent.last_payment_error?.message ?? "Payment failed";
        const order = await getOrderByStripePaymentIntentId(stripePaymentIntentId);
        if (order && order.status === "pending") {
          await updateOrderStatus(order.id, "failed");
          console.log(`[Webhook] Order #${order.id} marked as failed: ${failureMessage}`);
        }
        break;
      }
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
    res.json({ received: true, eventType: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Webhook] Error processing event:", message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  const { existsSync } = await import("fs");
  const webBuildCandidates = [
    path.join(process.cwd(), "web-build"),
    path.join(process.cwd(), "..", "web-build"),
    "/usr/src/app/web-build",
    "/app/web-build"
  ];
  const webBuildPath = webBuildCandidates.find((p) => existsSync(p)) ?? webBuildCandidates[0];
  console.log(`[web] cwd=${process.cwd()} | web-build path=${webBuildPath} | exists=${existsSync(webBuildPath)}`);
  if (existsSync(webBuildPath)) {
    app.use(express.static(webBuildPath));
    app.get("*", (req, res) => {
      if (!req.path.startsWith("/api") && !req.path.startsWith("/webhook")) {
        res.sendFile(path.join(webBuildPath, "index.html"));
      } else {
        res.status(404).json({ error: "Not found" });
      }
    });
    console.log(`[web] Serving static web build from ${webBuildPath}`);
  } else {
    console.warn(`[web] No web-build directory found \u2014 checked: ${webBuildCandidates.join(", ")}`);
    app.get("*", (req, res) => {
      if (!req.path.startsWith("/api") && !req.path.startsWith("/webhook")) {
        res.status(503).send("<html><body><h2>App loading...</h2><p>The web app is being deployed. Please refresh in a moment.</p></body></html>");
      } else {
        res.status(404).json({ error: "Not found" });
      }
    });
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}
startServer().catch(console.error);
startReviewEmailPoller();
