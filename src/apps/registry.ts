/**
 * The "add an app" contract (design §6, plan Phase 3). A sub-app is declared by
 * one entry here plus a route at `src/app/apps/<slug>/`; the home page maps over
 * this list to render its tiles. Keep this the single source of truth so adding
 * an app stays a two-step change.
 */
export type AppEntry = {
  /** URL segment and stable id, e.g. "chores". Also the React key on the tile. */
  slug: string;
  /** Display name shown on the tile. */
  name: string;
  /** One-line description shown under the name. */
  description: string;
  /** Optional icon/emoji for the tile. */
  icon?: string;
};

/**
 * Where an app lives. Derived from the slug rather than stored, so the route and
 * the registry entry can't drift (a hand-written href that disagreed with the
 * slug would ship a broken tile). Every sub-app lives at `/apps/<slug>`.
 */
export function appHref(app: AppEntry): string {
  return `/apps/${app.slug}`;
}

/**
 * Registered sub-apps, in display order. Empty until Phase 4 adds the first one
 * — the home page renders an empty state for this case, so an empty list is a
 * valid, expected state, not a bug.
 */
export const apps: AppEntry[] = [];
