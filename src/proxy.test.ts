import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The gate's verify step is mocked: this test is about the gate's *behavior*
// (redirect vs. pass, and which paths it runs on), not about JWT crypto — that
// is `verifyToken`'s own concern. A matcher bug is either a total lockout or an
// auth bypass, so it's covered explicitly below (plan T1).
vi.mock("@/lib/session", () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from "@/lib/session";

import { config, proxy } from "./proxy";

const mockedVerifyToken = vi.mocked(verifyToken);

describe("proxy gate", () => {
  beforeEach(() => {
    mockedVerifyToken.mockReset();
  });

  it("redirects to sign-in when there is no valid token", async () => {
    mockedVerifyToken.mockResolvedValue(null);

    const response = await proxy(
      new NextRequest("https://portal.test/chores?foo=bar"),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/api/auth/signin");
    // The originally-requested path is preserved so sign-in can return there.
    expect(location.searchParams.get("callbackUrl")).toBe("/chores?foo=bar");
  });

  it("lets the request through when the token is valid", async () => {
    mockedVerifyToken.mockResolvedValue({ email: "kid@example.com" });

    const response = await proxy(new NextRequest("https://portal.test/chores"));

    // NextResponse.next() is a pass-through: no redirect Location header.
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("returns 401 (not a redirect) for unauthenticated non-GET requests", async () => {
    mockedVerifyToken.mockResolvedValue(null);

    // A Server Action POST after the session expired: a 307 would re-POST the
    // body to the sign-in endpoint, so the gate answers 401 instead.
    const response = await proxy(
      new NextRequest("https://portal.test/chores", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });
});

// Asserting the matcher directly: a too-broad pattern gates `/api/auth` (login
// loop / lockout), a too-narrow one leaks protected routes. Both are silent in
// the happy path, so they're pinned here (plan T1).
describe("proxy matcher", () => {
  const matches = (url: string) =>
    unstable_doesMiddlewareMatch({ config, url });

  it("gates the home page and arbitrary app routes", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/chores")).toBe(true);
    expect(matches("/apps/chores/today")).toBe(true);
  });

  it("leaves the auth endpoints reachable (else sign-in itself is gated)", () => {
    expect(matches("/api/auth/signin")).toBe(false);
    expect(matches("/api/auth/callback/google")).toBe(false);
    expect(matches("/api/auth/signout")).toBe(false);
  });

  it("leaves the denied page reachable without a session", () => {
    expect(matches("/denied")).toBe(false);
  });

  it("does not gate framework internals or static assets", () => {
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });

  // Each exclusion is boundary-anchored: a path that merely starts with an
  // excluded token must still be gated, or it silently bypasses the gate.
  it("still gates routes that only share a prefix with an exclusion", () => {
    expect(matches("/api/authors")).toBe(true);
    expect(matches("/denied-export")).toBe(true);
    expect(matches("/faviconXico")).toBe(true);
  });
});
