import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { GoogleProfile } from "next-auth/providers/google";

import { env } from "@/env";
import { isAllowedSignIn } from "@/lib/access";
import {
  isPastAbsoluteExpiry,
  nowInSeconds,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session-policy";

// `auth` is intentionally not exported: the session-reading path goes through
// `getSession`/`requireSession` (one verify implementation, plan Phase 2).
// Re-export it only when a consumer needs it, to avoid a second verify path.
export const { handlers, signIn, signOut } = NextAuth({
  // Auth.js v5 won't trust the forwarded host behind a deploy proxy without
  // this, and callback/redirect detection silently fails.
  trustHost: true,
  providers: [
    Google({
      // Pre-filter the account chooser to the Workspace domain. UX only — the
      // server-side `signIn` gate below is the real check.
      authorization: {
        params: { hd: env.ALLOWED_GOOGLE_DOMAIN },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 60 * 60, // refresh the cookie at most hourly while active
  },
  // A rejected real login lands on our page, not Auth.js's default error screen.
  pages: {
    error: "/denied",
  },
  callbacks: {
    signIn({ profile }) {
      const google = profile as GoogleProfile | undefined;
      return isAllowedSignIn({
        email: google?.email,
        emailVerified: google?.email_verified,
        hd: google?.hd,
        allowedDomain: env.ALLOWED_GOOGLE_DOMAIN,
        adminEmails: env.ADMIN_EMAILS,
      });
    },
    jwt({ token, profile }) {
      // `profile` is only present at initial sign-in: stamp the absolute expiry.
      if (profile) {
        token.absoluteExpiry = nowInSeconds() + SESSION_MAX_AGE_SECONDS;
      }
      // Past the absolute cap, invalidate the token: returning null clears the
      // session cookie, forcing re-authentication and a fresh signIn re-gate.
      // This is what makes the cap hold even when activity keeps sliding `exp`.
      if (isPastAbsoluteExpiry(token.absoluteExpiry)) {
        return null;
      }
      return token;
    },
    // email/name/picture are kept on the token/session by Auth.js's defaults.
    // We intentionally do NOT expose `domain` on the session yet: it has no
    // consumer, and its correct value differs for break-glass admins (no/foreign
    // `hd`) vs domain members. Add it with explicit semantics when a caller needs
    // it (design §5 / Phase 3+), not speculatively.
  },
});

declare module "@auth/core/jwt" {
  interface JWT {
    /** Unix seconds. Absolute session expiry; not extended by activity. */
    absoluteExpiry?: number;
  }
}
