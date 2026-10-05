interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

/** Material Symbols, the icon font the design uses. Decorative, so hidden from screen readers. */
export function Icon({ name, className = "", filled = false }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}
