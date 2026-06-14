import type { ReactNode } from "react";

/**
 * Full-height, centered page wrapper with the app's light/dark background.
 * Pages supply only their `<main>` content; the shell owns the outer chrome so
 * layout/theme changes live in one place.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      {children}
    </div>
  );
}
