import Image from "next/image";

import { Button } from "@/components/button";
import type { SessionUser } from "@/lib/session";

type Props = {
  user: SessionUser;
  /**
   * Server action that ends the session. Passed in (rather than imported here)
   * so this component stays presentational and unit-testable without pulling in
   * `@/auth` and its env requirements; the home page wires the real `signOut`.
   */
  signOutAction: () => Promise<void>;
};

/**
 * The signed-in user's chip (avatar + name) plus a sign-out control, for the
 * home page header. Falls back to the email, then an initial, when name/picture
 * are absent (break-glass admins may have neither).
 */
export function UserMenu({ user, signOutAction }: Props) {
  // `||` (not `??`) so a blank name ("") falls through to the email too, not
  // just a null one — otherwise the chip and its initial render empty.
  const label = user.name || user.email;
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {user.picture ? (
        <Image
          src={user.picture}
          alt=""
          width={32}
          height={32}
          // A 32px avatar gains nothing from the image optimizer, and going
          // unoptimized serves the Google URL directly — no server-side fetch
          // of googleusercontent.com (which can fail) and no remotePatterns
          // allowlist to keep in sync. A deleted avatar still 404s, but the
          // common path no longer depends on the optimizer reaching Google.
          unoptimized
          className="rounded-full"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {initial}
        </span>
      )}
      <span className="max-w-[12rem] truncate text-sm font-medium text-black dark:text-zinc-50">
        {label}
      </span>
      <form action={signOutAction}>
        <Button type="submit" variant="secondary" className="h-9 px-4 text-sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
