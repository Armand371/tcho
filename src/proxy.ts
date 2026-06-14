import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { verifyToken } from "@/lib/session";

/**
 * Optimistic auth gate. Runs before every matched route (Next 16's renamed
 * middleware) and bounces requests without a valid session to sign-in.
 *
 * This is deliberately *optimistic*: it's a fast redirect, not the authority.
 * Pages / route handlers / server actions MUST still re-verify with
 * `requireSession()` — a matcher gap or a Server Function moved off a matched
 * path would otherwise leak (see the Next proxy docs on Server Functions). The
 * `requireSession()` re-check is the defense-in-depth that makes a matcher bug
 * a redirect-miss, not a data leak. Both this and `requireSession()` call the
 * single `verifyToken` (plan Phase 2: one verify implementation, two callers).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const token = await verifyToken(request);
  if (token) return NextResponse.next();

  // Non-navigation requests (API fetches, Server Action POSTs) must not get a
  // redirect: a 307 preserves the method, so a POST body is re-sent to the
  // sign-in endpoint, and a JSON client can't parse the HTML sign-in page.
  // Answer those with 401 and let the client decide. We only redirect GETs
  // (document loads AND RSC navigations, which the client router follows).
  if (request.method !== "GET") {
    return new NextResponse(null, { status: 401 });
  }

  // No valid session → send to sign-in, preserving where they were headed.
  const signInUrl = new URL("/api/auth/signin", request.url);
  signInUrl.searchParams.set(
    "callbackUrl",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    /*
     * Gate everything EXCEPT the public allowlist. A matcher that's too broad
     * locks out sign-in (login loop); too narrow leaks routes — so the excluded
     * set is deliberately minimal and tested (plan T1). Each token is anchored
     * with `(?:/|$)` (and `favicon\.ico$`) so it only excludes the path itself
     * or a child of it — without the boundary, `/api/authors`, `/denied-export`
     * or `/faviconXico` would all slip past the gate:
     *   - api/auth      Auth.js endpoints (sign-in/callback/sign-out). MUST stay
     *                   reachable or the redirect target itself gets gated.
     *   - denied        the access-denied page, shown to users with no session.
     *   - _next/static,
     *     _next/image,
     *     favicon.ico   framework internals / static assets.
     */
    "/((?!api/auth(?:/|$)|denied(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)",
  ],
};
