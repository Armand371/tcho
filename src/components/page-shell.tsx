import type { ReactNode } from "react";

type Variant = "center" | "top";

/**
 * Full-height page wrapper that owns the app's light/dark background and base
 * font, so theme changes live in one place. Two layouts:
 *
 *   - `center` (default) — vertically/horizontally centers a small message with
 *     its own horizontal padding (e.g. the /denied page).
 *   - `top` — a top-aligned, full-width canvas; children manage their own
 *     max-width and padding (e.g. the home page header + tile grid).
 */
export function PageShell({
  children,
  variant = "center",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  const className = [
    "flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black",
    variant === "center" && "items-center justify-center px-6",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={className}>{children}</div>;
}
