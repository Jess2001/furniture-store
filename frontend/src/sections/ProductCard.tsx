import { useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { useCartActions } from "../cart/useCart";
import { Icon } from "../components/Icon";
import { designImages } from "../content/images";
import { useUi } from "../hooks/UiContext";
import { errorMessage } from "../lib/api";
import { formatKES, pickImage, sizeLabel, stockLabel, swatchLabel } from "../lib/format";
import type { ProductCardData } from "../lib/types";

const toneClasses = {
  ok: { dot: "bg-tertiary", text: "text-tertiary" },
  low: { dot: "bg-tertiary", text: "text-tertiary" },
  out: { dot: "bg-error", text: "text-error" },
} as const;

export function ProductCard({ product }: { product: ProductCardData }) {
  const { user, openAuth } = useAuth();
  const { setCartOpen, showToast } = useUi();
  const { add } = useCartActions();

  // variants arrive cheapest first, so the first one is the default
  const [selectedId, setSelectedId] = useState(product.variants[0]?.id);
  const selected = product.variants.find((v) => v.id === selectedId) ?? product.variants[0];

  const swatches = product.variants.filter((v) => v.color_hex);
  const sizes = product.variants.filter((v) => !v.color_hex && v.dimensions);
  const stock = stockLabel(product.stock_status, product.low_stock_count);
  const tone = toneClasses[stock.tone];

  const image = pickImage(product.primary_image?.image_url, designImages.products[product.slug]);
  const canBuy = Boolean(selected?.in_stock) && product.in_stock;

  const addToCart = () => {
    if (!selected) return;
    if (!user) {
      showToast("Sign in to add pieces to your cart.");
      openAuth();
      return;
    }
    add.mutate(
      { variantId: selected.id },
      {
        onSuccess: () => {
          showToast(`${product.name} added to your cart.`);
          setCartOpen(true);
        },
        onError: (error) => showToast(errorMessage(error)),
      },
    );
  };

  return (
    <article className="group bg-surface-container-lowest border border-surface-variant flex flex-col justify-between transition-all duration-300">
      <div>
        <div className="relative aspect-[4/5] bg-surface-container-low overflow-hidden">
          <img
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            alt={product.primary_image?.alt_text || product.name}
            src={image}
          />
          {product.badge && (
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
              <span className="bg-primary-container text-on-primary font-label-caps text-label-caps uppercase px-2 py-0.5 tracking-wider">
                {product.badge}
              </span>
            </div>
          )}
          <button
            type="button"
            disabled
            aria-label="Add to wishlist (coming soon)"
            title="Wishlist is coming soon"
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-surface-container-lowest/80 text-on-surface flex items-center justify-center opacity-70"
          >
            <Icon name="favorite" className="text-[18px]" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
            <span className={`font-body-sm text-body-sm font-semibold ${tone.text}`}>{stock.text}</span>
          </div>
          <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider block">
            {product.category.name}
          </span>
          <h3 className="font-title text-title text-on-surface font-semibold mt-0.5 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-currency-price text-currency-price text-on-surface font-bold">
              {selected ? formatKES(selected.price) : "Price on request"}
            </span>
            {selected?.compare_at_price && (
              <span className="font-body-sm text-body-sm text-secondary line-through">
                {formatKES(selected.compare_at_price)}
              </span>
            )}
          </div>

          {swatches.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-surface-variant">
              <span className="font-label-caps text-label-caps text-secondary mr-1">
                {swatchLabel(product.category.slug)}:
              </span>
              {swatches.map((variant) => {
                const active = variant.id === selected?.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    title={variant.color}
                    aria-label={variant.color}
                    aria-pressed={active}
                    onClick={() => setSelectedId(variant.id)}
                    style={{ backgroundColor: variant.color_hex }}
                    className={`w-4 h-4 rounded-full border cursor-pointer ${
                      active ? "border-primary ring-1 ring-primary/40" : "border-surface-variant"
                    }`}
                  />
                );
              })}
            </div>
          )}

          {sizes.length > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-variant">
              <span className="font-label-caps text-label-caps text-secondary">Size:</span>
              {sizes.map((variant) => {
                const active = variant.id === selected?.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    aria-pressed={active}
                    title={variant.in_stock ? variant.dimensions : `${variant.dimensions} (out of stock)`}
                    onClick={() => setSelectedId(variant.id)}
                    className={`font-label-caps text-label-caps px-1.5 py-0.5 ${
                      active ? "bg-on-surface text-on-secondary" : "bg-surface-container text-on-surface"
                    } ${variant.in_stock ? "" : "line-through opacity-60"}`}
                  >
                    {sizeLabel(variant.dimensions)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pt-0">
        <button
          type="button"
          onClick={addToCart}
          disabled={!canBuy || add.isPending}
          className="w-full h-11 bg-on-surface text-on-secondary hover:bg-primary transition-colors flex items-center justify-center gap-2 font-label-md text-label-md uppercase tracking-wider disabled:opacity-50 disabled:hover:bg-on-surface"
        >
          <Icon name="shopping_bag" className="text-[18px]" />
          {canBuy ? (add.isPending ? "Adding…" : "Add to Cart") : "Out of Stock"}
        </button>
      </div>
    </article>
  );
}
