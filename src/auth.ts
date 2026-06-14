import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { GoogleProfile } from "next-auth/providers/google";

import { env } from "@/env";

/**
 * Access policy, extracted as a pure function so it can be exhaustively
 * table-tested (plan T2) without standing up Auth.js or Google.
 *
 * A user may sign in iff their email is verified AND either:
 *   - the account belongs to the allowed Workspace domain — proven by the `hd`
 *     claim AND the email's own domain (both must match; the email suffix alone
 *     is spoofable by consumer accounts using a vanity address), or
 *   - the email is on the break-glass `ADMIN_EMAILS` allowlist (the recovery
 *     path if domain gating misfires; design §9).
 *
 * "Belongs to the domain" means the allowed domain exactly OR a subdomain of it
 * (a Workspace owns all its subdomains, so `eng.example.com` is in `example.com`).
 * `endsWith("." + domain)` matches subdomains while rejecting look-alikes like
 * `example.com.evil.com` and `notexample.com`.
 *
 * `adminEmails` is expected pre-normalized (trimmed, lowercased) — `src/env.ts`
 * does that when parsing `ADMIN_EMAILS`.
 */
export function isAllowedSignIn(params: {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
  hd: string | null | undefined;
  allowedDomain: string;
  adminEmails: readonly string[];
}): boolean {
  const { email, emailVerified, hd, allowedDomain, adminEmails } = params;

  // Strict `=== true`: the claim is untrusted input and Google has historically
  // sent it as a string; a bare `!emailVerified` would let "false" through.
  if (emailVerified !== true) return false;

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;

  // Break-glass: an explicitly allowlisted address gets in regardless of domain.
  if (adminEmails.includes(normalizedEmail)) return true;

  const domain = allowedDomain.trim().toLowerCase();
  if (!domain) return false;

  const emailDomain = normalizedEmail.split("@").at(-1);

  return inDomain(hd, domain) && inDomain(emailDomain, domain);
}

/** True if `candidate` is `domain` itself or a subdomain of it. */
function inDomain(
  candidate: string | null | undefined,
  domain: string,
): boolean {
  const c = candidate?.trim().toLowerCase();
  if (!c) return false;
  return c === domain || c.endsWith(`.${domain}`);
}

// ~24h session. Statelessness means a JWT can't be revoked, so this window is a
// security control: access changes (removed member, narrowed domain) take effect
// only when the token expires and the user must re-authenticate (re-running the
// signIn gate). NOTE: JWT sessions slide — Auth.js re-signs `exp = now + maxAge`
// on every session read — so `maxAge` alone is only an *idle* timeout. The
// `jwt` callback below stamps an *absolute* expiry to enforce the 24h cap even
// for a continuously-active session.
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        token.absoluteExpiry =
          Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
      }
      // Past the absolute cap, invalidate the token: returning null clears the
      // session cookie, forcing re-authentication and a fresh signIn re-gate.
      // This is what makes the cap hold even when activity keeps sliding `exp`.
      if (
        typeof token.absoluteExpiry === "number" &&
        Math.floor(Date.now() / 1000) > token.absoluteExpiry
      ) {
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
