import { z } from "zod";

/**
 * Validated environment variables. Import `env` from here instead of reading
 * `process.env` directly so that missing/invalid config fails fast at startup
 * with a clear error, and every value is fully typed.
 *
 * - Server-only vars go in the schema as-is.
 * - Browser-exposed vars MUST be prefixed with `NEXT_PUBLIC_`.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Client var — must start with NEXT_PUBLIC_ to reach the browser.
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // --- Auth (Auth.js v5 / Google). Server-only: never NEXT_PUBLIC_. ---

  // Signs the session JWT. Generate with `npx auth secret` (or `openssl rand -base64 32`).
  AUTH_SECRET: z.string().min(1),
  // Google OAuth 2.0 Web client credentials (see .env.example for setup).
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  // The Google Workspace domain allowed to sign in (e.g. "example.com").
  ALLOWED_GOOGLE_DOMAIN: z.string().min(1),
  // Break-glass allowlist: comma-separated emails permitted regardless of domain.
  // Parsed to a normalized `string[]` (trimmed, lowercased, empties dropped).
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  // Canonical deployment URL. Optional in dev (Auth.js infers it from the host).
  AUTH_URL: z.string().url().optional(),
});

type Env = z.infer<typeof schema>;

/**
 * Required auth secrets have no defaults, so `schema.parse(process.env)` throws
 * at import time when they're absent — which breaks a secret-less `next build`
 * (e.g. in CI). The t3-env escape hatch: when `SKIP_ENV_VALIDATION` is set, skip
 * validation and return a typed stub. CI sets it only for the `build` step; real
 * runtime never sets it, so production still validates and fails fast.
 */
function loadEnv(): Env {
  if (process.env.SKIP_ENV_VALIDATION) {
    return process.env as unknown as Env;
  }

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      z.flattenError(parsed.error).fieldErrors,
    );
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = loadEnv();
