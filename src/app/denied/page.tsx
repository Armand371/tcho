import { Button } from "@/components/button";
import { PageShell } from "@/components/page-shell";
import { signOutAction } from "@/lib/auth-actions";

export const metadata = {
  title: "Sign-in problem",
};

// Auth.js routes ALL sign-in failures here (via `pages.error` in src/auth.ts),
// not just access-policy rejections — config errors, verification failures, and
// expired OAuth state all land here too, distinguished only by `?error=`. So we
// branch on it: a real off-domain rejection is `AccessDenied`; anything else is
// a transient/operational fault and must NOT be reported as "you're forbidden".
// https://authjs.dev/reference/core/errors
type Props = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function DeniedPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;
  const isAccessDenied = code === "AccessDenied";

  const heading = isAccessDenied ? "Access denied" : "Couldn't sign you in";
  const message = isAccessDenied
    ? "This account isn't allowed to use this portal. Access is limited to family members. If you have another account that should work, sign out and try again."
    : "Something went wrong while signing in — this is usually temporary. Sign out and try again; if it keeps happening, the sign-in may be misconfigured.";

  return (
    <PageShell>
      <main className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {heading}
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {message}
        </p>
        <form action={signOutAction}>
          <Button type="submit" className="px-6">
            Sign out
          </Button>
        </form>
      </main>
    </PageShell>
  );
}
