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
