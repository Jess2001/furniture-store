import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Icon } from "../components/Icon";
import { formatKES } from "../lib/format";
import type { Category, Facets } from "../lib/types";
import {
  activeFilterCount,
  PRICE_BANDS,
  toggleValue,
  type ShopFilters,
} from "./filters";

const heading =
  "font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant block font-bold";
const divider = <div className="h-px bg-surface-variant w-full" />;

function Check({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="flex items-center gap-2 text-on-surface group-hover:text-primary">
        <input
          type="checkbox"
          className="accent-primary rounded w-4 h-4 cursor-pointer"
          checked={checked}
          onChange={onChange}
        />
        <span>{label}</span>
      </span>
      {count !== undefined && (
        <span className="text-on-surface-variant font-label-md text-label-md">
          {count}
        </span>
      )}
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-space-xs">
      <span className={heading}>{title}</span>
      <div className="space-y-2 pt-1 font-body-sm text-body-sm">{children}</div>
    </div>
  );
}

interface FilterSidebarProps {
  filters: ShopFilters;
  facets?: Facets;
  categories?: Category[];
  onChange: (change: Partial<ShopFilters>) => void;
  onReset: () => void;
}

export function FilterSidebar({
  filters,
  facets,
  categories,
  onChange,
  onReset,
}: FilterSidebarProps) {
  const [minText, setMinText] = useState(filters.minPrice);
  const [maxText, setMaxText] = useState(filters.maxPrice);

  // keep the boxes in step when the address bar changes (reset, back button, price chips)
  useEffect(() => setMinText(filters.minPrice), [filters.minPrice]);
  useEffect(() => setMaxText(filters.maxPrice), [filters.maxPrice]);

  const commitPrice = (event?: FormEvent) => {
    event?.preventDefault();
    const clean = (text: string) =>
      text.trim() !== "" && Number(text) >= 0 ? String(Number(text)) : "";
    const next = { minPrice: clean(minText), maxPrice: clean(maxText) };
    if (
      next.minPrice !== filters.minPrice ||
      next.maxPrice !== filters.maxPrice
    )
      onChange(next);
  };

  const active = activeFilterCount(filters);
  const priceHint =
    facets?.price.min && facets.price.max
      ? `${formatKES(facets.price.min)} – ${formatKES(facets.price.max)}`
      : "";

  return (
    <div className="space-y-space-lg">
      <div className="flex items-center justify-between pb-space-xs">
        <div className="flex items-center gap-2">
          <Icon name="tune" className="text-primary text-[20px]" />
          <h3 className="font-title text-title text-on-surface">
            Refine Pieces
          </h3>
        </div>
        {active > 0 && (
          <span className="font-label-caps text-label-caps text-tertiary bg-tertiary-fixed px-2 py-0.5 rounded">
            Active ({active})
          </span>
        )}
      </div>

      <Group title="Availability">
        <Check
          label="In Stock & Ready to Ship"
          count={facets?.in_stock_count}
          checked={filters.inStock}
          onChange={() => onChange({ inStock: !filters.inStock })}
        />
      </Group>

      {divider}

      <Group title="Room & Space">
        {categories?.map((category) => (
          <Check
            key={category.id}
            label={category.name}
            count={category.product_count}
            checked={filters.categories.includes(category.slug)}
            onChange={() =>
              onChange({
                categories: toggleValue(filters.categories, category.slug),
              })
            }
          />
        ))}
      </Group>

      {facets && facets.materials.length > 0 && (
        <>
          {divider}
          <Group title="Timber & Core Materials">
            {facets.materials.map((material) => (
              <Check
                key={material.name}
                label={material.name}
                count={material.count}
                checked={filters.materials.includes(material.name)}
                onChange={() =>
                  onChange({
                    materials: toggleValue(filters.materials, material.name),
                  })
                }
              />
            ))}
          </Group>
        </>
      )}

      {facets && facets.colors.length > 0 && (
        <>
          {divider}
          <div className="space-y-space-xs">
            <span className={heading}>Upholstery Tones</span>
            <div className="grid grid-cols-6 gap-2 pt-1">
              {facets.colors.map((color) => {
                const on = filters.colors.includes(color.name);
                return (
                  <button
                    key={color.name}
                    type="button"
                    title={color.name}
                    aria-label={color.name}
                    aria-pressed={on}
                    onClick={() =>
                      onChange({
                        colors: toggleValue(filters.colors, color.name),
                      })
                    }
                    style={{ backgroundColor: color.hex || "#d6c3b9" }}
                    className={`w-8 h-8 rounded-full shadow-sm hover:scale-110 transition-transform flex items-center justify-center ${
                      on
                        ? "ring-2 ring-primary ring-offset-2"
                        : "border border-surface-variant"
                    }`}
                  >
                    {on && (
                      <span className="w-1.5 h-1.5 rounded-full bg-on-surface" />
                    )}
                  </button>
                );
              })}
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant block pt-1">
              Selected:{" "}
              <strong className="text-on-surface">
                {filters.colors.length ? filters.colors.join(", ") : "Any"}
              </strong>
            </span>
          </div>
        </>
      )}

      {divider}

      <div className="space-y-space-xs">
        <div className="flex items-center justify-between">
          <span className={heading}>Price Range (KES)</span>
        </div>
        {priceHint && (
          <p className="font-label-md text-label-md text-primary font-semibold">
            {priceHint}
          </p>
        )}
        <form onSubmit={commitPrice} className="flex items-center gap-2 pt-1">
          <input
            aria-label="Minimum price"
            inputMode="numeric"
            type="number"
            min={0}
            placeholder="Min"
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            onBlur={() => commitPrice()}
            className="w-full h-9 px-2 bg-surface-container-low border border-outline-variant font-body-sm text-body-sm outline-none focus:border-primary"
          />
          <span className="text-outline">–</span>
          <input
            aria-label="Maximum price"
            inputMode="numeric"
            type="number"
            min={0}
            placeholder="Max"
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            onBlur={() => commitPrice()}
            className="w-full h-9 px-2 bg-surface-container-low border border-outline-variant font-body-sm text-body-sm outline-none focus:border-primary"
          />
        </form>
        <div className="grid grid-cols-2 gap-1.5 pt-2">
          {PRICE_BANDS.map((band) => {
            const on =
              filters.minPrice === band.min && filters.maxPrice === band.max;
            return (
              <button
                key={band.label}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(
                    on
                      ? { minPrice: "", maxPrice: "" }
                      : { minPrice: band.min, maxPrice: band.max },
                  )
                }
                className={`px-2 py-1 rounded font-label-md text-label-md text-center transition-colors ${
                  on
                    ? "bg-surface-container text-on-surface font-bold"
                    : "bg-surface-container-low hover:bg-surface-variant text-on-surface"
                }`}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full bg-surface-container-low hover:bg-surface-variant text-on-surface py-2 rounded-lg font-label-md text-label-md transition-colors"
      >
        Reset to Default
      </button>
    </div>
  );
}
