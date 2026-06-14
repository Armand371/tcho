import { AppTile } from "@/components/app-tile";
import type { AppEntry } from "@/apps/registry";

/**
 * Renders the home page's apps: a responsive grid of {@link AppTile}s, or an
 * empty state when no apps are registered yet. Kept separate from the home page
 * (a server component) so both branches are unit-testable without a session
 * (plan Phase 3: tile rendering + empty-state).
 */
export function AppGrid({ apps }: { apps: AppEntry[] }) {
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-black/[.12] px-6 py-20 text-center dark:border-white/[.145]">
        <p className="font-medium text-black dark:text-zinc-50">No apps yet</p>
        <p className="max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Apps will appear here once they&apos;re added to the portal.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <li key={app.slug}>
          <AppTile app={app} />
        </li>
      ))}
    </ul>
  );
}
