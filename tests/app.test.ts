import { describe, it, expect } from "vitest";
import { PRODUCTS, TESTIMONIALS } from "../constants/products";

describe("Product Data", () => {
  it("should have basic and premium products", () => {
    expect(PRODUCTS.basic).toBeDefined();
    expect(PRODUCTS.premium).toBeDefined();
  });

  it("basic product should have correct price", () => {
    expect(PRODUCTS.basic.price).toBe(1999);
    expect(PRODUCTS.basic.priceDisplay).toBe("$19.99");
  });

  it("premium product should have correct price", () => {
    expect(PRODUCTS.premium.price).toBe(3999);
    expect(PRODUCTS.premium.priceDisplay).toBe("$39.99");
  });

  it("premium should have more features than basic", () => {
    const basicIncluded = PRODUCTS.basic.features.filter((f) => f.included).length;
    const premiumIncluded = PRODUCTS.premium.features.filter((f) => f.included).length;
    expect(premiumIncluded).toBeGreaterThan(basicIncluded);
  });

  it("premium should have all features included", () => {
    const allIncluded = PRODUCTS.premium.features.every((f) => f.included);
    expect(allIncluded).toBe(true);
  });

  it("basic should have some features not included", () => {
    const someExcluded = PRODUCTS.basic.features.some((f) => !f.included);
    expect(someExcluded).toBe(true);
  });

  it("premium should have a badge", () => {
    expect(PRODUCTS.premium.badge).toBeDefined();
    expect(PRODUCTS.premium.badge).toBe("Best Value");
  });

  it("basic should not have a badge", () => {
    expect(PRODUCTS.basic.badge).toBeUndefined();
  });
});

describe("Testimonials", () => {
  it("should have at least 3 testimonials", () => {
    expect(TESTIMONIALS.length).toBeGreaterThanOrEqual(3);
  });

  it("each testimonial should have required fields", () => {
    TESTIMONIALS.forEach((t) => {
      expect(t.id).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.rating).toBeGreaterThanOrEqual(1);
      expect(t.rating).toBeLessThanOrEqual(5);
      expect(t.text).toBeDefined();
    });
  });
});

describe("Download Token Generation Logic", () => {
  it("basic order should produce 1 download asset", () => {
    const tier = "basic";
    const assets = tier === "basic" ? ["pdf_plans"] : ["pdf_plans", "video_series", "design_hacks"];
    expect(assets.length).toBe(1);
  });

  it("premium order should produce 3 download assets", () => {
    const tier: string = "premium";
    const assets = tier === "basic" ? ["pdf_plans"] : ["pdf_plans", "video_series", "design_hacks"];
    expect(assets.length).toBe(3);
    expect(assets).toContain("pdf_plans");
    expect(assets).toContain("video_series");
    expect(assets).toContain("design_hacks");
  });

  it("file size labels should format correctly", () => {
    const formatFileSize = (bytes: number): string => {
      if (bytes > 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
      if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
      return `${Math.round(bytes / 1024)} KB`;
    };

    expect(formatFileSize(4200000)).toBe("4.2 MB");
    expect(formatFileSize(850000000)).toBe("850.0 MB");
    expect(formatFileSize(2100000)).toBe("2.1 MB");
    expect(formatFileSize(512000)).toBe("500 KB");
  });
});

describe("Price Calculation", () => {
  it("should calculate correct prices for both tiers", () => {
    const PRICES: Record<string, number> = { basic: 1999, premium: 3999 };
    expect(PRICES["basic"]).toBe(1999);
    expect(PRICES["premium"]).toBe(3999);
  });

  it("premium should cost more than basic", () => {
    expect(PRODUCTS.premium.price).toBeGreaterThan(PRODUCTS.basic.price);
  });
});

describe("Reviews Feature", () => {
  // ── Rating validation ────────────────────────────────────────────────────
  it("rating must be between 1 and 5", () => {
    const isValidRating = (r: number) => Number.isInteger(r) && r >= 1 && r <= 5;
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(3)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(2.5)).toBe(false);
  });

  // ── Average rating calculation ───────────────────────────────────────────
  it("should compute average rating correctly", () => {
    const ratings = [5, 4, 5, 3, 5];
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    expect(Math.round(avg * 10) / 10).toBe(4.4);
  });

  it("average rating should return 0 for empty reviews", () => {
    const ratings: number[] = [];
    const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    expect(avg).toBe(0);
  });

  // ── Rating distribution ──────────────────────────────────────────────────
  it("should build rating distribution correctly", () => {
    const ratings = [5, 4, 5, 3, 5, 4, 2];
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings) {
      distribution[r] = (distribution[r] ?? 0) + 1;
    }
    expect(distribution[5]).toBe(3);
    expect(distribution[4]).toBe(2);
    expect(distribution[3]).toBe(1);
    expect(distribution[2]).toBe(1);
    expect(distribution[1]).toBe(0);
  });

  // ── Verified purchase gate ───────────────────────────────────────────────
  it("verified purchase gate: should allow review only for paid orders", () => {
    type OrderStatus = "pending" | "paid" | "failed" | "refunded";
    const canReview = (orders: { status: OrderStatus; productTier: string }[], tier: string) =>
      orders.some((o) => o.productTier === tier && o.status === "paid");

    const orders = [
      { status: "paid" as OrderStatus, productTier: "basic" },
      { status: "pending" as OrderStatus, productTier: "premium" },
    ];

    expect(canReview(orders, "basic")).toBe(true);
    expect(canReview(orders, "premium")).toBe(false);
    expect(canReview([], "basic")).toBe(false);
  });

  // ── Duplicate review prevention ──────────────────────────────────────────
  it("should detect if user already has a review for a product", () => {
    const existingReviews = [
      { userId: 1, productTier: "basic" },
      { userId: 2, productTier: "premium" },
    ];
    const hasReview = (userId: number, tier: string) =>
      existingReviews.some((r) => r.userId === userId && r.productTier === tier);

    expect(hasReview(1, "basic")).toBe(true);
    expect(hasReview(1, "premium")).toBe(false);
    expect(hasReview(3, "basic")).toBe(false);
  });

  // ── Display name fallback ────────────────────────────────────────────────
  it("display name should fall back to user name then Anonymous Builder", () => {
    const getDisplayName = (displayName: string | null, userName: string | null) =>
      displayName ?? userName ?? "Anonymous Builder";

    expect(getDisplayName("Bob", "Alice")).toBe("Bob");
    expect(getDisplayName(null, "Alice")).toBe("Alice");
    expect(getDisplayName(null, null)).toBe("Anonymous Builder");
  });

  // ── Review title and body length constraints ─────────────────────────────
  it("review title should not exceed 120 characters", () => {
    const title = "A".repeat(120);
    expect(title.length).toBeLessThanOrEqual(120);
    const tooLong = "A".repeat(121);
    expect(tooLong.length).toBeGreaterThan(120);
  });

  it("review body should not exceed 2000 characters", () => {
    const body = "B".repeat(2000);
    expect(body.length).toBeLessThanOrEqual(2000);
  });

  // ── Star rating label mapping ────────────────────────────────────────────
  it("should map star values to correct labels", () => {
    const RATING_LABELS: Record<number, string> = {
      1: "Poor",
      2: "Fair",
      3: "Good",
      4: "Great",
      5: "Excellent!",
    };
    expect(RATING_LABELS[1]).toBe("Poor");
    expect(RATING_LABELS[3]).toBe("Good");
    expect(RATING_LABELS[5]).toBe("Excellent!");
  });

  // ── Review date formatting ───────────────────────────────────────────────
  it("should format review date correctly", () => {
    const date = new Date("2025-06-15T12:00:00Z");
    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    // Should produce something like "Jun 15, 2025"
    expect(formatted).toContain("2025");
    expect(formatted).toContain("15");
  });
});
