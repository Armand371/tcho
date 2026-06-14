import Link from "next/link";

import { appHref, type AppEntry } from "@/apps/registry";

/**
 * A single app tile on the home page. Presentational only — it takes an
 * {@link AppEntry} and links to its derived route; the gate (proxy +
 * `requireSession`) is what protects the destination, not this component.
 */
export function AppTile({ app }: { app: AppEntry }) {
  return (
    <Link
      href={appHref(app)}
      className="flex h-full flex-col gap-2 rounded-2xl border border-black/[.08] bg-white p-5 transition-colors hover:border-transparent hover:bg-black/[.03] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-zinc-900"
    >
      {app.icon ? (
        <span aria-hidden className="text-2xl leading-none">
          {app.icon}
        </span>
      ) : null}
      <span className="font-medium text-black dark:text-zinc-50">
        {app.name}
      </span>
      <span className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {app.description}
      </span>
    </Link>
  );
}
