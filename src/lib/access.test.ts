import { describe, expect, it } from "vitest";

import { isAllowedSignIn } from "@/lib/access";

// Plan T2 — exhaustive, table-driven coverage of the access predicate. This is
// the single security boundary deciding who gets a session, so every branch
// (and the spoof case) is a row, not a happy-path smoke test.
describe("isAllowedSignIn", () => {
  const allowedDomain = "example.com";
  const adminEmails = ["admin@outside.test"];

  type Row = {
    name: string;
    params: Parameters<typeof isAllowedSignIn>[0];
    expected: boolean;
  };

  const base = { allowedDomain, adminEmails };

  const rows: Row[] = [
    {
      name: "in-domain + verified → allow",
      params: {
        ...base,
        email: "kid@example.com",
        emailVerified: true,
        hd: "example.com",
      },
      expected: true,
    },
    {
      name: "email_verified false → deny",
      params: {
        ...base,
        email: "kid@example.com",
        emailVerified: false,
        hd: "example.com",
      },
      expected: false,
    },
    {
      name: "email_verified missing → deny",
      params: {
        ...base,
        email: "kid@example.com",
        emailVerified: undefined,
        hd: "example.com",
      },
      expected: false,
    },
    {
      name: "missing hd → deny (consumer account, no Workspace)",
      params: {
        ...base,
        email: "kid@example.com",
        emailVerified: true,
        hd: undefined,
      },
      expected: false,
    },
    {
      name: "hd present but email domain differs → deny (the spoof case)",
      params: {
        ...base,
        // hd says example.com, but the email belongs elsewhere — a mismatch
        // that the email suffix alone would miss.
        email: "attacker@evil.com",
        emailVerified: true,
        hd: "example.com",
      },
      expected: false,
    },
    {
      name: "email in allowed domain but hd is a look-alike → deny",
      params: {
        ...base,
        email: "kid@example.com",
        emailVerified: true,
        hd: "notexample.com",
      },
      expected: false,
    },
    {
      name: "ADMIN_EMAILS match from outside the domain → allow (break-glass)",
      params: {
        ...base,
        email: "admin@outside.test",
        emailVerified: true,
        hd: undefined,
      },
      expected: true,
    },
    {
      name: "ADMIN_EMAILS match but unverified email → deny",
      params: {
        ...base,
        email: "admin@outside.test",
        emailVerified: false,
        hd: undefined,
      },
      expected: false,
    },
    {
      name: "case-insensitive email + hd normalization → allow",
      params: {
        ...base,
        email: "Kid@EXAMPLE.com",
        emailVerified: true,
        hd: "Example.com",
      },
      expected: true,
    },
    {
      name: "subdomain of the allowed domain → allow (Workspace owns subdomains)",
      params: {
        ...base,
        email: "kid@eng.example.com",
        emailVerified: true,
        hd: "eng.example.com",
      },
      expected: true,
    },
    {
      name: "suffix look-alike (example.com.evil.com) → deny",
      params: {
        ...base,
        email: "attacker@example.com.evil.com",
        emailVerified: true,
        hd: "example.com.evil.com",
      },
      expected: false,
    },
    {
      name: "null email → deny",
      params: {
        ...base,
        email: null,
        emailVerified: true,
        hd: "example.com",
      },
      expected: false,
    },
  ];

  it.each(rows)("$name", ({ params, expected }) => {
    expect(isAllowedSignIn(params)).toBe(expected);
  });
});
