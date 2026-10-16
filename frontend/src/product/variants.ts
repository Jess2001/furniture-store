import type { VariantDetail } from "../lib/types";

export type OptionAttr = "material" | "color" | "dimensions";

/** The attributes a variant can differ by, in the order the shopper is asked about them. */
export const ATTRS: { key: OptionAttr; label: string }[] = [
  { key: "material", label: "Material" },
  { key: "color", label: "Colour" },
  { key: "dimensions", label: "Size" },
];

export interface OptionGroup {
  attr: OptionAttr;
  label: string;
  values: string[];
}

export type Selection = Partial<Record<OptionAttr, string>>;

/** The most of one piece we let someone add at once when stock is plentiful. */
const MAX_PER_ORDER = 10;

/** Only attributes that actually differ between variants become questions. */
export function optionGroups(variants: VariantDetail[]): OptionGroup[] {
  return ATTRS.flatMap(({ key, label }) => {
    const values = [...new Set(variants.map((v) => v[key]).filter(Boolean))];
    return values.length > 1 ? [{ attr: key, label, values }] : [];
  });
}

/** What a variant would look like as a set of choices. */
export function selectionOf(
  variant: VariantDetail,
  groups: OptionGroup[],
): Selection {
  const selection: Selection = {};
  for (const group of groups) selection[group.attr] = variant[group.attr];
  return selection;
}

/** The variant that matches every choice made, if there is one. */
export function resolveVariant(
  variants: VariantDetail[],
  selection: Selection,
): VariantDetail | undefined {
  const picks = Object.entries(selection) as [OptionAttr, string][];
  return variants.find((v) =>
    picks.every(([attr, value]) => v[attr] === value),
  );
}

/**
 * Applies one choice. If that exact combination does not exist, it moves to the
 * nearest real one: the variant with the chosen value that keeps the most of the
 * other choices, preferring one that is in stock.
 */
export function choose(
  variants: VariantDetail[],
  groups: OptionGroup[],
  current: Selection,
  attr: OptionAttr,
  value: string,
): Selection {
  const candidates = variants.filter((v) => v[attr] === value);
  if (candidates.length === 0) return current;

  const kept = (v: VariantDetail) =>
    groups.filter((g) => g.attr !== attr && v[g.attr] === current[g.attr])
      .length;

  const best = candidates.reduce((winner, v) => {
    const difference = kept(v) - kept(winner);
    if (difference !== 0) return difference > 0 ? v : winner;
    return v.in_stock && !winner.in_stock ? v : winner;
  });
  return selectionOf(best, groups);
}

/** Is at least one variant with this value in stock? */
export function valueInStock(
  variants: VariantDetail[],
  attr: OptionAttr,
  value: string,
): boolean {
  return variants.some((v) => v[attr] === value && v.in_stock);
}

export function hexFor(variants: VariantDetail[], colour: string): string {
  return variants.find((v) => v.color === colour)?.color_hex ?? "";
}

/** How many of this variant a shopper may add: what is left, or a sensible cap. */
export function maxQuantity(variant: VariantDetail | undefined): number {
  if (!variant || !variant.in_stock) return 1;
  if (
    variant.stock_status === "low_stock" &&
    variant.low_stock_count !== null
  ) {
    return Math.max(1, variant.low_stock_count);
  }
  return MAX_PER_ORDER;
}
