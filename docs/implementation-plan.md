# Implementation Plan: tcho portal

Status: Draft (eng-reviewed 2026-06-14) · Implements: [design.md](./design.md)

This plan turns the design into ordered, verifiable phases. Each phase ends in a
state where `npm run lint && npm run typecheck && npm test && npm run build` is
green, so we can stop or ship between phases.

## Decisions (post eng-review)

- **Auth library is decided by a Phase-0 spike, not assumed.** We are stacking
  two betas (`next-auth@5` on `next@16`). Rather than guess, Phase 0 timeboxes
  **both** candidates and keeps whichever installs + gates cleanly:
  - **Candidate A — Auth.js (NextAuth v5):** handles the full OAuth/OIDC
    handshake (state, PKCE, CSRF, cookies) for us, JWT session strategy
    (stateless, no DB).
  - **Candidate B — hand-rolled OAuth + `jose`:** ~80 lines following the Next
    auth guide's stateless recipe. No beta dependency; we own the surface.

  Same phase structure either way — only the internals of `src/auth.ts` +
  `src/lib/session.ts` differ. See Phase 0.

  **SPIKE OUTCOME (recorded 2026-06-14): Candidate A (Auth.js v5) wins.**
  `next-auth@5.0.0-beta.31` installs against `next@16.2.9` + React 19.2.4 with no
  peer conflict (deduped `next`), `next build` (Turbopack) is green, and a
  throwaway `proxy.ts` reading the token directly via `getToken` redirected a
  logged-out request to a protected route (`GET /` → `307 /api/auth/signin`)
  while `/denied` and `/api/auth/*` stayed reachable — i.e. it **gates**, not
  just builds. The only runtime error in the spike was `UntrustedHost` on the
  sign-in page, which is the known `trustHost: true` requirement already
  captured in Phase 1 (not a blocker). Candidate B (`jose`) was not needed.

- **Gate location: `src/proxy.ts`** (Next 16's renamed middleware, Node.js
  runtime by default).

- **One verification implementation, two callers (DRY).** `src/lib/session.ts`
  exposes a single token-verify function. `src/proxy.ts` calls it for the
  _optimistic_ route gate; `requireSession()` calls it for the _authoritative_
  check in pages / route handlers / server actions. The proxy reads the token
  directly (`getToken` for Candidate A, `jwtVerify` for Candidate B) — **not**
  the Auth.js middleware wrapper, which avoids the `middleware.ts`→`proxy.ts`
  rename risk. Defense-in-depth re-check stays per the Next auth guide.

- **Access = domain membership OR break-glass admin.** `signIn` allows a user
  when `email_verified` is true AND (`hd === ALLOWED_GOOGLE_DOMAIN` and the email
  domain matches) OR the email is in an `ADMIN_EMAILS` allowlist. The admin
  branch is the recovery path if domain gating misfires (design §9 fallback).

- **Short session lifetime is a security control, not polish.** Statelessness
  means a JWT can't be revoked — removing a member or narrowing the domain only
  takes effect when the token expires. So we set a **~24h sliding `maxAge` in
  Phase 1** and document the posture: "access changes take effect within 24h."

## Phase 0 — Spike, scaffolding & config

Goal: pick the auth library on evidence, install deps, extend env (without
breaking secret-less CI builds). App still runs as today.

1. **Auth-library spike (timeboxed).** In a throwaway branch, stand up the
   minimal Google sign-in for **Candidate A** (`npm install next-auth@beta`,
   `npx auth secret`, a Google provider, a protected page). Confirm it
   **builds AND gates** (logged-out request actually redirects) under `next@16`
   with the `proxy.ts` convention. If it fights back, stand up **Candidate B**
   (`jose` + a hand-rolled callback). Keep the winner; record the decision in
   this file. **A passing `npm run build` is NOT sufficient — verify the gate
   redirects, since build success and runtime wiring are different things.**
2. **Extend `src/env.ts`** with server-only vars (no `NEXT_PUBLIC_` prefix):
   `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_GOOGLE_DOMAIN`,
   `ADMIN_EMAILS` (comma-separated → parsed to `string[]`), `AUTH_URL` (optional
   in dev).
   - **CI-build guard (P1):** required secrets with no defaults make
     `next build` throw at import time, and CI builds without secrets. Add a
     `SKIP_ENV_VALIDATION` short-circuit to `env.ts` (the t3-env pattern): when
     set, skip `.parse()` and return a typed stub. CI sets it for the `build`
     step; real runtime still validates. (Today's `env.ts` only builds because
     every var has `.default()` — that stops being true here.)
3. **`.env.example`** — document the new keys + a pointer to the Google Cloud
   OAuth client.
4. **Google Cloud (manual, documented):** OAuth 2.0 Web client; redirect URI
   `http://localhost:3000/api/auth/callback/google` (dev) and the prod URL later.

Acceptance: spike winner recorded; `SKIP_ENV_VALIDATION npm run build` green with
no secrets present; `env.ts` throws clearly at real runtime when a required var
is missing.

---

## Phase 1 — Auth core + domain gate

Goal: a family member signs in with Google; off-domain users are rejected;
sessions are short-lived.

1. **`src/auth.ts`** (shape depends on Phase-0 winner):
   - Google provider; **JWT session strategy** with **`maxAge` ~24h, sliding**.
   - **`trustHost: true`** (Auth.js v5 won't trust `AUTH_URL` behind a deploy
     proxy without it — callback/redirect detection silently fails otherwise).
   - `signIn` gate: allow iff `profile.email_verified` AND
     (`profile.hd === env.ALLOWED_GOOGLE_DOMAIN` and email domain matches) OR
     `ADMIN_EMAILS` contains the email. Reject → `/denied`.
   - `pages: { error: "/denied" }` so a rejected real login lands on our page,
     not Auth.js's default `?error=AccessDenied` screen.
   - `jwt`/`session` callbacks keep only `email`, `name`, `picture`, `domain`.
   - `verbatimModuleSyntax`: use `import type` for type-only imports.
2. **`src/app/api/auth/[...nextauth]/route.ts`** — export the auth handlers.
3. **`src/app/denied/page.tsx`** — static "access denied" + sign-out link.

Acceptance (manual smoke, `npm run dev`): domain account signs in; personal
`@gmail.com` lands on `/denied` with no session cookie; an `ADMIN_EMAILS` address
signs in even from outside the domain.

---

## Phase 2 — The gate: shared verify helper + proxy

Goal: every route protected behind one verification implementation.

1. **`src/lib/session.ts`** (the single source of truth):
   - `verifyToken(req?)` — the one place that decodes/verifies the JWT
     (`getToken` or `jwtVerify`). **Same `AUTH_SECRET` + cookie name as
     `auth.ts`** — a mismatch here makes the gate silently no-op (see test T1).
   - `getSession()` → typed user | null (wraps `verifyToken`, `cache()`d).
   - `requireSession()` → redirects to sign-in when absent, else returns user.
2. **`src/proxy.ts`** — optimistic gate calling `verifyToken`:
   - Public allowlist: `/api/auth/*`, `/denied`, static assets.
   - Else no valid token → redirect to `/api/auth/signin`.
   - `export const config = { matcher: [...] }` with the negative-lookahead
     pattern; **`/api/auth` must stay reachable** (excluded from the matcher).
3. Comment the rule in-code: pages / route handlers / server actions re-check via
   `requireSession()` — proxy is optimistic only.

Acceptance: logged-out `/` → redirect; signed-in `/` → renders; protected route
logged-out → redirected, not served. Tests below are **required**, not optional.

**Required tests (Phase 2):**

- **T1 — proxy gate (mock `verifyToken`/`getToken`):** no token → redirect;
  valid token → pass; `/api/auth/*` and `/denied` reachable without a session.
  Optionally assert the matcher with `unstable_doesProxyMatch`. A matcher bug is
  either a total lockout or an auth bypass, so this gates the phase.
- **T2 — table-driven `signIn` predicate (pure function):** rows for in-domain +
  verified (allow), `email_verified` false (deny), missing `hd` (deny),
  `hd` present but email domain differs (deny — the spoof case), `ADMIN_EMAILS`
  match (allow), case/subdomain normalization.

---

## Phase 3 — Home page + app registry

1. **`src/apps/registry.ts`** — typed `AppEntry[]` (`slug`, `name`,
   `description`, `icon?`, `href`). This is the design's "add an app" contract.
   Mind `noUncheckedIndexedAccess` (indexed access is `T | undefined`).
2. **`src/app/page.tsx`** — server component: `requireSession()`, header with
   user name/avatar + sign-out, map registry → tiles (Tailwind v4), empty state.
3. **`src/components/{app-tile,user-menu}.tsx`** — colocated `*.test.tsx`:
   tile rendering + empty-state.

Acceptance: signed-in `/` shows user chip + tiles (or empty state); sign-out
clears the session. Component tests pass.

---

## Phase 4 — First sub-app (prove the shared-session contract)

1. **`src/app/apps/<slug>/page.tsx`** — minimal real-ish app reading the current
   user via `getSession()`/`requireSession()`. No provider, no Google call.
2. Add its `AppEntry` to the registry.
3. Confirm the same cookie (same origin, path `/`) is read with zero extra
   wiring — the contract the design promises.

Acceptance: open from a home tile while signed in → greets the user; logged out
→ proxy redirects. Document the 2-step "add an app" recipe in the README/docs.

---

## Phase 5 — Polish & guardrails

- **Error states:** friendly handling for OAuth errors / canceled consent.
- **Sign-out everywhere:** reachable from any sub-app.
- **CI:** keep lint → format:check → typecheck → test → build green; ensure the
  `build` step sets `SKIP_ENV_VALIDATION`. Run `npm run format` before pushing.
- **Secrets:** `.env.local` git-ignored; real secrets only in host env.

(Session lifetime moved to Phase 1 — it's a security control, not polish.)

---

## What already exists (reuse, don't rebuild)

- `src/env.ts` Zod validation pattern — extend it; add the `SKIP_ENV_VALIDATION`
  guard rather than a parallel config loader.
- Vitest + Testing Library (jsdom) + colocated `*.test.tsx` conventions — all new
  tests follow them; no new test infra.
- Strict TS config (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`) — already
  enforced by CI; new code conforms.
- Nothing in the app shell solves auth/session today — that part is genuinely new.

## NOT in scope (considered, deferred)

- **Database / persistent store** — design constraint is stateless; revisit only
  if we need true revocation or per-user roles.
- **Per-user roles / parents-only apps** — registry can later grow an
  `allow?(user)` predicate (design §9). Not built now.
- **Immediate revocation (denylist)** — rejected for v1 in favor of short
  `maxAge`; the ~24h window is the accepted bound.
- **Cross-origin / separately-deployed sub-apps** — shared-cookie trick is
  same-origin only; a token-passing scheme is future work (design §9).
- **Non-Google identity providers, public sign-up, password auth** — out by
  design.

## Failure modes (per new codepath)

| Codepath      | Realistic failure                         | Test?     | Error handling              | User sees                              |
| ------------- | ----------------------------------------- | --------- | --------------------------- | -------------------------------------- |
| `signIn` gate | Google omits `hd` for a valid member      | T2 row    | break-glass `ADMIN_EMAILS`  | `/denied` (clear)                      |
| `signIn` gate | `ALLOWED_GOOGLE_DOMAIN` typo'd            | manual    | `ADMIN_EMAILS` recovery     | `/denied` (clear)                      |
| `verifyToken` | proxy/auth secret or cookie-name mismatch | **T1**    | —                           | gate no-ops → **critical if untested** |
| proxy matcher | too broad → `/api/auth` gated             | **T1**    | —                           | login loop / lockout                   |
| proxy matcher | too narrow → route leaks                  | **T1**    | `requireSession()` re-check | data exposure if both fail             |
| session       | token expired mid-use                     | (Auth.js) | redirect to sign-in         | re-login (clear)                       |
| CI build      | required env var, no secret               | guarded   | `SKIP_ENV_VALIDATION`       | build passes                           |

No remaining failure mode is both untested AND silent AND unhandled — the one
that would be (verify-config mismatch) is covered by the now-required T1.

## Worktree parallelization

Mostly sequential: Phases 1→2→3→4 form a dependency chain (gate depends on auth;
home depends on session helper; sub-app depends on the contract). The only
independent lane is presentational.

| Step                  | Modules                                      | Depends on    |
| --------------------- | -------------------------------------------- | ------------- |
| Auth core (Ph1)       | `src/auth.ts`, `app/api/auth`, `app/denied`  | Phase 0 spike |
| Gate (Ph2)            | `src/lib`, `src/proxy.ts`                    | Auth core     |
| Home + registry (Ph3) | `src/app/page`, `src/apps`, `src/components` | Gate          |
| Sub-app (Ph4)         | `src/app/apps/*`                             | Home contract |

`Lane A: Ph1 → Ph2 → Ph3 → Ph4 (sequential)` · `Lane B: component visuals
(AppTile/UserMenu styling) can be built against mocked session in parallel with
Ph1–2, merged at Ph3.` Low conflict risk (Lane B touches only `src/components`).

## Implementation Tasks

Synthesized from this review. Checkbox as you ship.

- [x] **T1 (P1, human: ~1h / CC: ~10min)** — `src/env.ts` — add `SKIP_ENV_VALIDATION` build guard ✅ done in Phase 0
  - Surfaced by: Outside voice #3 — required `AUTH_*` vars break secret-less `next build` in CI
  - Files: `src/env.ts`, `.github/workflows/ci.yml`
  - Verify: `SKIP_ENV_VALIDATION=1 npm run build` passes with no `.env.local`
- [ ] **T2 (P1, human: ~30min / CC: ~5min)** — `src/proxy.ts` — read token directly via shared `verifyToken`, not the Auth.js middleware wrapper
  - Surfaced by: Architecture A1 — `middleware.ts`→`proxy.ts` rename risk
  - Files: `src/proxy.ts`, `src/lib/session.ts`
  - Verify: T1 proxy test (below) green
- [ ] **T3 (P1, human: ~2h / CC: ~15min)** — auth tests — required proxy gate test + table-driven `signIn` test
  - Surfaced by: Test review T1/T2 — security-critical paths were happy-path/optional
  - Files: `src/proxy.test.ts`, `src/auth.test.ts` (or colocated)
  - Verify: `npx vitest run` covers no-token redirect, allowlist reachability, and all signIn rows
- [ ] **T4 (P2, human: ~20min / CC: ~5min)** — `src/auth.ts` — `ADMIN_EMAILS` break-glass branch in `signIn`
  - Surfaced by: Architecture A2 — total-lockout risk if domain gating misfires
  - Files: `src/auth.ts`, `src/env.ts`
  - Verify: T2 admin row green
- [ ] **T5 (P2, human: ~15min / CC: ~5min)** — `src/auth.ts` — `maxAge` ~24h sliding + documented posture
  - Surfaced by: Outside voice #6/#7 — stateless JWT can't be revoked
  - Files: `src/auth.ts`, `docs/design.md`
  - Verify: session cookie expiry ≤24h; design notes the window
- [ ] **T6 (P2, human: ~10min / CC: ~3min)** — `src/auth.ts` — `trustHost: true` + `pages.error: /denied` + `email_verified` check
  - Surfaced by: Outside voice #4, #8 + Architecture A3
  - Files: `src/auth.ts`
  - Verify: rejected login lands on `/denied`; unverified email denied (T2 row)

## Risks & open questions

- **Two-beta stack (`next-auth@5` × `next@16`)** — resolved by the Phase-0 spike;
  jose is the proven alternative, not just a fallback.
- **`hd` + `email_verified` trust** — verify Google returns both for the
  Workspace during the Phase-1 smoke test.
- **24h revocation window** — accepted posture; tightening requires a denylist or
  a DB (out of scope).
- **Cross-origin sub-apps** — future scheme; same-origin only for now.

## Appendix — the two auth candidates

- **Candidate A (Auth.js):** least code if the betas cooperate; OAuth/CSRF/cookies
  handled. Risk: beta-on-beta integration.
- **Candidate B (jose):** OAuth/PKCE via a small helper or direct OIDC calls under
  `app/api/auth/*`; session as a signed JWT (`SignJWT`/`jwtVerify`, HS256);
  `verifyToken` decrypts it. Same `hd`/admin gate, same `/denied`. More code we
  own, zero third-party version risk.

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status               | Findings                                                             |
| ------------- | --------------------- | ------------------------------- | ---- | -------------------- | -------------------------------------------------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0    | —                    | not run                                                              |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0    | —                    | not installed                                                        |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1    | issues_open → folded | 8 issues (3 arch, 1 quality, 2 test, +8 outside-voice); 0 unresolved |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 0    | —                    | not run                                                              |
| DX Review     | `/plan-devex-review`  | Developer experience gaps       | 0    | —                    | not run                                                              |

- **OUTSIDE VOICE (Claude subagent, Codex not installed):** 8 findings. Caught a P1 the review missed (secret-less CI build break, T1). 3 folded directly (trustHost, email_verified, shared-secret/cookie via T1); 3 raised as cross-model tensions and decided by the user (auth-library primacy → Phase-0 spike; revocation → 24h sliding maxAge; session paths → single shared verify helper, DRY).
- **CROSS-MODEL:** no unresolved tension — all three disagreements were taken to the user and decided.
- **VERDICT:** ENG CLEARED — ready to implement. CEO/Design/DX optional, not run.

NO UNRESOLVED DECISIONS
