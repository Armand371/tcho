/**
 * Session-lifetime policy shared by the two paths that must agree on it:
 *   - `src/auth.ts` (the `jwt` callback) stamps and enforces the cap when
 *     Auth.js reads/re-signs the cookie, and
 *   - `src/lib/session.ts` (`verifyToken`) enforces it on the direct
 *     `getToken` read used by the proxy gate.
 *
 * Keeping the constant and the check here means a change to the cap (window,
 * clock-skew tolerance, claim name) happens in one place and can't silently
 * desync the optimistic gate from the cookie-clearing path.
 */

/**
 * ~24h absolute session cap. Statelessness means a JWT can't be revoked, so this
 * window is a security control: access changes (removed member, narrowed domain)
 * take effect only when the token expires and the user must re-authenticate
 * (re-running the signIn gate). JWT sessions slide — Auth.js re-signs
 * `exp = now + maxAge` on every read — so `maxAge` alone is only an *idle*
 * timeout; the stamped `absoluteExpiry` enforces the cap even for a
 * continuously-active session.
 */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** True once a token is past its stamped absolute expiry (the hard 24h cap). */
export function isPastAbsoluteExpiry(absoluteExpiry: unknown): boolean {
  return typeof absoluteExpiry === "number" && nowInSeconds() > absoluteExpiry;
}
