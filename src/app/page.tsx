import { apps } from "@/apps/registry";
import { AppGrid } from "@/components/app-grid";
import { PageShell } from "@/components/page-shell";
import { UserMenu } from "@/components/user-menu";
import { signOutAction } from "@/lib/auth-actions";
import { requireSession } from "@/lib/session";

export default async function Home() {
  // Authoritative session check — the proxy gate is optimistic only (plan
  // Phase 2). A logged-out request never reaches this render: it redirects.
  const user = await requireSession();

  return (
    <PageShell variant="top">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6">
        <h1 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
          tcho
        </h1>
        <UserMenu user={user} signOutAction={signOutAction} />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
        <AppGrid apps={apps} />
      </main>
    </PageShell>
  );
}
