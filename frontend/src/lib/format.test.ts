import { describe, expect, it } from "vitest";

import { formatKES, pickImage, sizeLabel, stockLabel, swatchLabel } from "./format";

describe("formatKES", () => {
  it("formats API decimal strings with thousands separators", () => {
    expect(formatKES("84500.00")).toBe("KES 84,500");
    expect(formatKES("1234567.50")).toBe("KES 1,234,567.5");
    expect(formatKES(0)).toBe("KES 0");
  });
});

describe("stockLabel", () => {
  it("shows the remaining count only when stock is low", () => {
    expect(stockLabel("low_stock", 3)).toEqual({ text: "In Stock (3 left)", tone: "low" });
    expect(stockLabel("in_stock", null)).toEqual({ text: "In Stock", tone: "ok" });
    expect(stockLabel("out_of_stock", null)).toEqual({ text: "Out of Stock", tone: "out" });
  });
});

describe("sizeLabel", () => {
  it("keeps the words before the first number", () => {
    expect(sizeLabel("Queen 160 x 200 cm")).toBe("Queen");
    expect(sizeLabel("King 180 x 200 cm")).toBe("King");
  });
  it("falls back to the whole text when it starts with a number", () => {
    expect(sizeLabel("220 x 95 x 85 cm")).toBe("220 x 95 x 85 cm");
  });
});

describe("swatchLabel", () => {
  it("uses the design's wording per room", () => {
    expect(swatchLabel("living-room")).toBe("Fabric");
    expect(swatchLabel("dining")).toBe("Timber");
    expect(swatchLabel("bedroom")).toBe("Finish");
  });
});

describe("pickImage", () => {
  it("prefers a real image over the design fallback", () => {
    expect(pickImage("https://cdn.example/a.jpg", "design.jpg")).toBe("https://cdn.example/a.jpg");
  });
  it("swaps placeholder and missing images for the design photo", () => {
    expect(pickImage("https://placehold.co/800x1000", "design.jpg")).toBe("design.jpg");
    expect(pickImage(null, "design.jpg")).toBe("design.jpg");
  });
  it("keeps the placeholder when there is no design photo", () => {
    expect(pickImage("https://placehold.co/800x1000", undefined)).toBe("https://placehold.co/800x1000");
  });
});
