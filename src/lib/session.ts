import { cache } from "react";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

import { env } from "@/env";
import { isPastAbsoluteExpiry } from "@/lib/session-policy";

/**
 * The single place that decodes/verifies the session JWT. Both callers go
 * through here so there is exactly one verify implementation (plan Phase 2):
 *
 *   - `src/proxy.ts`            — the *optimistic* per-route gate (passes `req`).
 *   - `requireSession()` below  — the *authoritative* re-check in pages / route
 *                                 handlers / server actions (reads `next/headers`).
 *
 * We read the cookie directly via Auth.js's `getToken` rather than the Auth.js
 * proxy/middleware wrapper, which avoids coupling to the `middleware.ts`→
 * `proxy.ts` rename (plan: Architecture A1).
 *
 * CRITICAL (plan T1): `getToken` must use the SAME `secret` and the SAME cookie
 * name as `src/auth.ts`. We don't override `cookieName`/`salt`, so both default
 * to Auth.js's `authjs.session-token` / `__Secure-authjs.session-token`, exactly
 * what `auth.ts` issues. The only variable is the `__Secure-` prefix, which
 * follows `secureCookie` — see `prefersSecureCookies`. Get this wrong and
 * `getToken` can't find/decrypt the cookie, returns `null`, and both callers
 * redirect: the gate fails *closed* (every valid user locked into a sign-in
 * loop), not open — so a cookie-name regression is a lockout, not a bypass.
 */
export async function verifyToken(req?: {
  headers: Headers;
}): Promise<JWT | null> {
  const source = req ?? { headers: await headers() };

  const token = await getToken({
    req: source,
    secret: env.AUTH_SECRET,
    // `salt` and `cookieName` are intentionally left to default off this flag,
    // matching how `auth.ts` chooses the cookie name. Get this wrong and the
    // gate no-ops (T1).
    secureCookie: prefersSecureCookies(source.headers),
  });

  if (!token) return null;

  // Enforce the absolute 24h cap here too. `auth.ts`'s `jwt` callback clears the
  // cookie past `absoluteExpiry`, but that only runs on an Auth.js session read
  // and re-sign — this direct `getToken` path bypasses it, so a token still
  // within its (sliding) `exp` could otherwise slip past the hard cap. Sharing
  // `isPastAbsoluteExpiry` keeps this consistent with the cookie-clearing path.
  if (isPastAbsoluteExpiry(token.absoluteExpiry)) return null;

  return token;
}

/** The signed-in user as exposed to the app. Mirrors the session in `auth.ts`. */
export type SessionUser = {
  email: string;
  name: string | null;
  picture: string | null;
};

/**
 * Typed current user, or `null` when there's no valid session. `cache()`d so
 * repeated calls within one request (e.g. layout + page) decode the cookie once.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = await verifyToken();
  if (!token) return null;

  // A session without an email isn't usable for anything we do with it; treat it
  // as unauthenticated rather than surfacing an empty-identity user.
  const email = typeof token.email === "string" ? token.email : null;
  if (!email) return null;

  return {
    email,
    name: typeof token.name === "string" ? token.name : null,
    picture: typeof token.picture === "string" ? token.picture : null,
  };
});

/**
 * Authoritative session check for pages / route handlers / server actions.
 * Redirects to sign-in when absent, so callers can treat the return as present.
 * The proxy gate is optimistic only — this is the real check (plan Phase 2).
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/api/auth/signin");
  return user;
}

/**
 * Whether Auth.js used the `__Secure-`-prefixed cookie, which it does when the
 * app is served over HTTPS. We must mirror Auth.js's own determination or
 * `getToken` looks for the wrong cookie name and locks everyone out (see the
 * `verifyToken` header). Auth.js (with `trustHost`) keys off the request's
 * protocol, falling back to `AUTH_URL`; we follow the same order:
 *   1. `x-forwarded-proto` — the actual request protocol behind a proxy, which
 *      is exactly what Auth.js saw when it issued the cookie.
 *   2. `AUTH_URL`'s scheme — the configured canonical URL, for direct TLS with
 *      no forwarding header.
 *   3. production default — real deploys are HTTPS.
 */
function prefersSecureCookies(reqHeaders: Headers): boolean {
  const proto = reqHeaders.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  if (env.AUTH_URL) return env.AUTH_URL.startsWith("https:");
  return env.NODE_ENV === "production";
}
