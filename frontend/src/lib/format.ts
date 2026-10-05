import type { StockStatus } from "./types";

export function formatKES(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export type StockTone = "ok" | "low" | "out";

export function stockLabel(
  status: StockStatus,
  lowStockCount: number | null,
): { text: string; tone: StockTone } {
  if (status === "out_of_stock") return { text: "Out of Stock", tone: "out" };
  if (status === "low_stock" && lowStockCount !== null) {
    return { text: `In Stock (${lowStockCount} left)`, tone: "low" };
  }
  return { text: "In Stock", tone: "ok" };
}

/** "Queen 160 x 200 cm" -> "Queen". Falls back to the whole text when it starts with a number. */
export function sizeLabel(dimensions: string): string {
  const leadingWords = dimensions.split(/\d/)[0].trim();
  return leadingWords || dimensions;
}

/** Design wording for the swatch row, by room. */
export function swatchLabel(categorySlug: string): string {
  if (categorySlug === "living-room") return "Fabric";
  if (["dining", "home-office", "storage-media", "outdoor-living"].includes(categorySlug)) return "Timber";
  return "Finish";
}

/** Seed data uses placehold.co images; in development prefer the design photo when we have one. */
export function pickImage(url: string | null | undefined, fallback: string | undefined): string {
  const isPlaceholder = !url || url.includes("placehold.co");
  if (isPlaceholder && fallback) return fallback;
  return url || fallback || "";
}
