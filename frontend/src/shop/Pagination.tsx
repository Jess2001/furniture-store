import { Icon } from "../components/Icon";

/** [1, "…", 4, 5, 6, "…", 20]: always the ends and the neighbours of the current page. */
export function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  keep.forEach((page, index) => {
    if (index > 0 && page - keep[index - 1] > 1) result.push("…");
    result.push(page);
  });
  return result;
}

const base =
  "w-10 h-10 rounded flex items-center justify-center font-label-md text-label-md transition-colors";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={`${base} bg-surface-container hover:bg-surface-variant text-on-surface disabled:text-outline-variant disabled:bg-surface-container-low disabled:cursor-not-allowed`}
      >
        <Icon name="chevron_left" className="text-[18px]" />
      </button>

      {pageWindow(page, totalPages).map((item, index) =>
        item === "…" ? (
          <span
            key={`gap-${index}`}
            className="w-6 text-center text-outline"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onChange(item)}
            className={`${base} ${
              item === page
                ? "bg-inverse-surface text-inverse-on-surface font-bold shadow-sm"
                : "bg-surface-container hover:bg-surface-variant text-on-surface"
            }`}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={`${base} bg-surface-container hover:bg-surface-variant text-on-surface disabled:text-outline-variant disabled:bg-surface-container-low disabled:cursor-not-allowed`}
      >
        <Icon name="chevron_right" className="text-[18px]" />
      </button>
    </nav>
  );
}
