# Design: tcho — a family app portal

Status: Draft · Last updated: 2026-06-14

## 1. Summary

`tcho` is a private web portal for our family. It does two jobs:

1. **Authenticates** family members with their Google accounts, gating access to
   anyone outside our Google Workspace domain.
2. **Hosts and links** the small web apps we build over time, presenting them as
   a directory of tiles and letting each app reuse the portal's signed-in
   session — so you log in once and every app knows who you are.

The first milestone is the **shell**: login, domain gating, a session that
sub-apps can read, and a home page that lists available apps. Individual apps
are added incrementally afterwards.

## 2. Goals / Non-goals

### Goals

- One Google sign-in for the whole portal and every sub-app under it.
- Restrict access to members of our Google Workspace domain (e.g.
  `@choquelfamily.com`). Nobody outside the domain can get in.
- A home page listing the apps a signed-in user can open.
- Sub-apps live under this same project/domain and share the portal session
  without each re-implementing auth.
- Stateless: no database to run or back up. Sessions are encrypted JWT cookies.
- Cheap and low-maintenance to operate.

### Non-goals (for now)

- Per-user roles or per-app permissions beyond "is a domain member". Everyone
  who can log in can see every app. (Revisited in §9.)
- A database, user-management UI, or audit log.
- Public sign-up, password auth, or non-Google identity providers.
- A plugin marketplace or dynamic app installation. Apps are added in code.

## 3. Constraints & assumptions

- We own a Google Workspace domain and every family member has an account on it.
  This is the linchpin of the access model — without it, "domain gating" has
  nothing to gate on, and we'd fall back to an email allowlist (§9).
- Stateless means **no server-side session store and no user table**. Anything
  we can't derive from the Google ID token or hardcode in config does not exist.
- This is a current Next.js (App Router, v16) + React 19 + TypeScript codebase.
  Env vars are validated through `src/env.ts` (Zod) — all new config goes there.

## 4. High-level architecture

```
                ┌─────────────────────────────────────────────┐
   Browser ───▶ │                 tcho (Next.js)              │
                │                                             │
                │  /                Home: tiles of apps       │
                │  /api/auth/*      Auth.js routes            │
                │  /apps/<slug>/*   Sub-apps (share session)  │
                │                                             │
                │  middleware.ts    Gate every route on a     │
                │                   valid, domain-matched JWT │
                └───────────────┬─────────────────────────────┘
                                │ OAuth 2.0 / OIDC
                                ▼
                        Google Identity (OIDC)
```

- A single Next.js app. Auth is handled by **Auth.js (NextAuth v5)** with the
  Google provider and the **JWT session strategy** (`strategy: "jwt"`), so the
  session lives entirely in an encrypted cookie — no database.
- **Middleware** runs on the edge in front of every route, redirecting
  unauthenticated or off-domain requests to the sign-in page.
- **Sub-apps** are route groups under the same Next.js app (e.g.
  `src/app/apps/<slug>/`). Because they're the same origin, they read the same
  session cookie for free — no per-app auth code.

### Why this shape

- "Sub-apps under one domain" + "stateless" maps almost exactly onto a single
  Next.js app with cookie-based JWT sessions. Same origin ⇒ same cookie ⇒
  shared session with zero plumbing. A database or separate deployments would
  add operational cost the requirements explicitly rule out.

## 5. Authentication & authorization

### Flow

1. User hits any route. Middleware checks for a valid session cookie.
2. If none, redirect to `/api/auth/signin` → Google consent screen.
3. Google returns an OIDC ID token. Auth.js runs our `signIn` callback.
4. **Domain check**: we verify the token's `hd` (hosted-domain) claim and the
   email domain equal our configured `ALLOWED_GOOGLE_DOMAIN`. If not, sign-in is
   rejected and the user sees an "access denied" page. They never get a session.
5. On success, Auth.js mints an encrypted JWT cookie. Subsequent requests carry
   it; middleware validates it on every route.

> **Note on `hd`:** the `hd` claim is the trustworthy signal that an account
> belongs to a Workspace domain — checking only the email's text suffix can be
> spoofed by consumer accounts that happen to use a vanity address. We require
> `hd === ALLOWED_GOOGLE_DOMAIN`. We also pass `hd` as an OAuth param to
> pre-filter the account chooser (UX only; the server-side check is the gate).

### What's in the session

Kept deliberately minimal (it's a cookie, and it's stateless):

- `email`, `name`, `picture` (from the ID token, for display)
- `domain` (the verified `hd`)

No roles, no app list — those are derived from config at request time.

### Authorization model

Binary for the first milestone: **a valid, domain-matched session may access
everything.** Per-app or per-user gating is a later addition (§9). Centralizing
the gate in middleware means a sub-app never has to think about auth.

## 6. App registry & sub-app contract

Apps are declared in a typed, in-code registry — e.g. `src/apps/registry.ts`:

```ts
export type AppEntry = {
  slug: string; // URL segment + stable id, e.g. "chores"
  name: string; // display name on the tile
  description: string;
  icon?: string; // optional icon/emoji for the tile
  href: string; // usually `/apps/${slug}`
};
```

- The **home page** maps over this registry to render tiles.
- Each app lives at `src/app/apps/<slug>/` as an App Router route group and
  renders behind the same middleware gate.
- A sub-app reads the current user from the shared session (a server helper like
  `auth()` from our Auth.js config) — it does **not** call Google or define its
  own provider.

This keeps "add a new app" to: create the route folder, add one registry entry.

## 7. Configuration (env)

All validated in `src/env.ts`. Proposed additions:

| Variable                    | Scope  | Purpose                                   |
| --------------------------- | ------ | ----------------------------------------- |
| `AUTH_SECRET`               | server | Encrypts/signs the session JWT (Auth.js). |
| `AUTH_GOOGLE_ID`            | server | Google OAuth client ID.                   |
| `AUTH_GOOGLE_SECRET`        | server | Google OAuth client secret.               |
| `ALLOWED_GOOGLE_DOMAIN`     | server | The Workspace domain allowed to sign in.  |
| `NEXTAUTH_URL` / `AUTH_URL` | server | Canonical app URL for OAuth callbacks.    |

`.env.example` gets documented (non-secret) placeholders for each. Secrets live
only in `.env.local` and the host's env settings.

## 8. Routing & middleware sketch

- `middleware.ts` with a `matcher` covering all routes except Next internals,
  static assets, and the auth endpoints themselves (`/api/auth/*`). Unauthenticated
  requests → redirect to sign-in.
- `/` — home: app tiles + a sign-out control + the user's name/avatar.
- `/api/auth/*` — Auth.js handlers (sign-in, callback, sign-out).
- `/apps/<slug>/*` — sub-apps.
- `/denied` — shown when a real Google login is rejected for being off-domain.

## 9. Open questions / future work

- **Beyond domain gating.** If we ever want some apps limited to certain people
  (e.g. parents-only), we need per-user/role info. Stateless options: encode
  roles from a small hardcoded map keyed by email at sign-in. Stateful option:
  introduce a DB. Out of scope now, but the registry could grow an
  `allow?: (user) => boolean` field to localize that decision.
- **Fallback identity model.** If domain gating proves awkward (e.g. a member
  without a Workspace account), fall back to a hardcoded email allowlist in env.
  The `signIn` callback is the single place that changes.
- **Sub-apps that aren't Next.js.** If an app must be its own deployment, the
  shared-cookie trick breaks across origins. We'd then need a token-passing
  scheme or move to a parent-domain cookie + subdomains. Documented as a fork in
  the road, not built now.
- **Session lifetime / refresh.** Decided: **~24h sliding `maxAge`** (set in
  `src/auth.ts`, Phase 1), refreshed at most hourly while active. This is a
  security control, not just UX: a stateless JWT can't be revoked, so access
  changes (removed member, narrowed domain) take effect only when the token
  expires. Posture: **access changes take effect within 24h.** Tightening that
  window requires a denylist or a DB (out of scope).
- **Deployment target.** Stateless + Next.js fits Vercel or any Node host
  cleanly; left open per the infra decision.

## 10. Milestones

1. **Shell + auth.** Auth.js Google provider, `signIn` domain check, JWT
   sessions, middleware gate, `/denied`. Env wired through `src/env.ts`.
2. **Home + registry.** App registry type, home page tiles, sign-out, user chip.
3. **First sub-app.** Prove the shared-session contract end to end with one real
   app under `/apps/<slug>`.
4. **Polish.** Session lifetime, error states, basic tests for the domain gate.

```

```
