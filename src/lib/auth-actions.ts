"use server";

import { signOut } from "@/auth";

/**
 * Shared sign-out server action — the single place that owns the post-sign-out
 * destination. Redirecting to "/" lands the now-anonymous request on the home
 * route, where the proxy bounces it to sign-in: i.e. the session is cleared and
 * the user ends up on the login flow. Used by every sign-out control (home page
 * chip, /denied) so they all behave identically (design Phase 5: "sign-out
 * everywhere").
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
