import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Icon } from "../components/Icon";
import { designImages } from "../content/images";
import { useProduct } from "../hooks/useCatalog";
import { ApiError } from "../lib/api";
import { formatKES, pickImage, stockLabel } from "../lib/format";
import type { ProductDetail } from "../lib/types";

const section = "w-full px-margin md:px-margin-tablet lg:px-margin-desktop";
const inner = "max-w-7xl mx-auto";

export function ProductPage() {
  const { slug = "" } = useParams();
  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useProduct(slug);

  useEffect(() => {
    document.title = product
      ? `${product.name} | Kilima Living`
      : "Kilima Living";
  }, [product]);

  if (isLoading) {
    return (
      <div className={`${section} py-space-xl`} data-testid="product-skeleton">
        <div
          className={`${inner} grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop`}
        >
          <div className="lg:col-span-7 aspect-[16/11] bg-surface-container animate-pulse rounded-xl" />
          <div className="lg:col-span-5 space-y-space-md">
            <div className="h-6 w-2/3 bg-surface-container animate-pulse" />
            <div className="h-10 w-full bg-surface-container animate-pulse" />
            <div className="h-24 w-full bg-surface-container animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError && error instanceof ApiError && error.status === 404) {
    return (
      <div className={`${section} py-space-3xl`}>
        <div className={`${inner} text-center space-y-space-md`}>
          <h1 className="font-display text-display text-on-surface">
            We could not find that piece
          </h1>
          <p className="font-body-lg text-body-lg text-secondary">
            It may have been retired from the collection, or the link may be
            mistyped.
          </p>
          <Link
            to="/shop"
            className="inline-block px-space-lg py-3 bg-primary text-on-primary rounded font-label-lg text-label-lg"
          >
            Browse the shop
          </Link>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className={`${section} py-space-xl`}>
        <div
          role="alert"
          className={`${inner} bg-error-container text-on-error-container p-space-md flex items-center justify-between`}
        >
          <span className="font-body-sm text-body-sm">
            We could not load this piece right now.
          </span>
          <button
            type="button"
            className="font-label-lg text-label-lg underline"
            onClick={() => refetch()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <ProductView product={product} />;
}

function ProductView({ product }: { product: ProductDetail }) {
  // variants arrive cheapest first, so the first is the default until the shopper chooses
  const variant = product.variants[0];
  const stock = stockLabel(product.stock_status, product.low_stock_count);
  const savings = variant?.compare_at_price
    ? Number(variant.compare_at_price) - Number(variant.price)
    : 0;

  return (
    <div className="flex flex-col w-full">
      {/* breadcrumb and stock note */}
      <section
        className={`${section} py-space-sm bg-surface-container-low text-on-surface`}
      >
        <div
          className={`${inner} flex flex-col md:flex-row items-start md:items-center justify-between gap-space-xs text-body-sm font-body-sm`}
        >
          <nav
            aria-label="Breadcrumbs"
            className="flex items-center gap-space-2xs text-secondary overflow-x-auto whitespace-nowrap py-space-2xs"
          >
            <Link className="hover:text-primary transition-colors" to="/">
              Home
            </Link>
            <span className="text-outline">/</span>
            <Link
              className="hover:text-primary transition-colors"
              to={`/shop?category=${product.category.slug}`}
            >
              {product.category.name}
            </Link>
            <span className="text-outline">/</span>
            <span className="text-on-surface font-medium truncate max-w-[200px] sm:max-w-none">
              {product.name}
            </span>
          </nav>
          {product.stock_status === "low_stock" &&
            product.low_stock_count !== null && (
              <div className="flex items-center gap-space-xs text-primary font-medium text-label-md">
                <span className="inline-block w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                <span>
                  Only {product.low_stock_count}{" "}
                  {product.low_stock_count === 1 ? "piece" : "pieces"} left in
                  Nairobi
                </span>
              </div>
            )}
        </div>
      </section>

      <section className={`${section} py-space-xl`}>
        <div
          className={`${inner} grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop`}
        >
          <div className="lg:col-span-7 flex flex-col gap-space-md">
            <Gallery product={product} />
            <div className="p-space-md rounded-xl bg-surface-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md shadow-sm">
              <div className="flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="handshake" className="text-[26px]" />
                </div>
                <div>
                  <p className="font-title text-title text-on-surface">
                    Karen Atelier Tailoring Guarantee
                  </p>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Every piece is individually hand-joined and inspected by
                    master joiners in Nairobi before dispatch.
                  </p>
                </div>
              </div>
              <Link
                to="/#showroom-booking"
                className="shrink-0 text-primary font-label-md text-label-md font-semibold hover:underline flex items-center gap-space-2xs"
              >
                <span>Complimentary Swatches</span>
                <Icon name="arrow_forward" className="text-[16px]" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col">
            <div className="flex items-center justify-between pb-space-2xs">
              <span className="font-label-caps text-label-caps tracking-widest text-primary font-semibold uppercase">
                {product.category.name} • Nairobi Joinery
              </span>
              {variant && (
                <span className="font-label-caps text-label-caps tracking-wider text-secondary uppercase bg-surface-container-high px-2 py-0.5 rounded">
                  SKU: {variant.sku}
                </span>
              )}
            </div>

            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1 mb-space-xs">
              {product.name}
            </h1>

            <div className="flex items-center gap-space-xs pb-space-sm">
              <span
                className={`w-2 h-2 rounded-full ${stock.tone === "out" ? "bg-error" : "bg-tertiary"}`}
              />
              <span
                className={`font-label-md text-label-md font-semibold ${stock.tone === "out" ? "text-error" : "text-tertiary"}`}
              >
                {stock.text}
              </span>
            </div>

            <div className="p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-space-2xs mb-space-md">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-display text-[32px] leading-tight text-on-surface font-medium">
                    {variant ? formatKES(variant.price) : "Price on request"}
                  </span>
                  {variant?.compare_at_price && (
                    <span className="font-body-sm text-body-sm text-secondary line-through">
                      {formatKES(variant.compare_at_price)}
                    </span>
                  )}
                </div>
                {savings > 0 && (
                  <span className="font-label-caps text-label-caps bg-tertiary-fixed text-on-tertiary-fixed font-semibold px-2 py-1 rounded">
                    Save {formatKES(savings)}
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-secondary flex items-center gap-space-2xs">
                <Icon name="verified" className="text-[16px] text-tertiary" />
                Prices in Kenyan shillings, delivery calculated at checkout
              </p>
            </div>

            {product.description && (
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-space-md">
                {product.description}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Gallery({ product }: { product: ProductDetail }) {
  const primary =
    product.images.find((image) => image.is_primary) ?? product.images[0];
  const fallback = designImages.products[product.slug];

  // the first picture may be a placeholder while we wait for real photography
  const pictures = product.images.map((image) => ({
    ...image,
    src:
      image.id === primary?.id
        ? pickImage(image.image_url, fallback)
        : image.image_url,
  }));

  const [activeId, setActiveId] = useState(primary?.id);
  const active =
    pictures.find((picture) => picture.id === activeId) ?? pictures[0];

  if (!active) {
    return (
      <div
        className="relative w-full aspect-[4/3] sm:aspect-[16/11] bg-surface-container-high rounded-xl flex items-center justify-center text-outline"
        data-testid="gallery-empty"
      >
        <Icon name="image" className="text-[48px]" />
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] bg-surface-container-high rounded-xl overflow-hidden shadow-md">
        <img
          data-testid="main-image"
          className="w-full h-full object-cover"
          alt={active.alt_text || product.name}
          src={active.src}
        />
        {product.badge && (
          <div className="absolute top-space-md left-space-md flex flex-wrap gap-space-2xs">
            <span className="bg-inverse-surface/90 text-inverse-on-surface font-label-caps text-label-caps px-space-sm py-1 rounded tracking-widest backdrop-blur-sm shadow-sm uppercase">
              {product.badge}
            </span>
          </div>
        )}
      </div>

      {pictures.length > 1 && (
        <div
          className="grid grid-cols-5 gap-space-xs sm:gap-space-sm"
          role="group"
          aria-label="More pictures"
        >
          {pictures.map((picture) => {
            const on = picture.id === active.id;
            return (
              <button
                key={picture.id}
                type="button"
                aria-label={`Show picture: ${picture.alt_text || product.name}`}
                aria-pressed={on}
                onClick={() => setActiveId(picture.id)}
                className={`relative aspect-[4/3] rounded-lg overflow-hidden bg-surface-container-high shadow-sm focus:outline-none ${
                  on ? "ring-2 ring-primary" : "opacity-75 hover:opacity-100"
                }`}
              >
                <img
                  className="w-full h-full object-cover"
                  alt=""
                  src={picture.src}
                />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
