/**
 * Access policy as a pure function — kept in its own module (no Auth.js / Next
 * imports) so it can be exhaustively table-tested (plan T2) without standing up
 * NextAuth or pulling in `next/server`. `src/auth.ts` calls it from `signIn`.
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
