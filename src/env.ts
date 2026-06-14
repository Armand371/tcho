import { z } from "zod";

/**
 * Validated environment variables. Import `env` from here instead of reading
 * `process.env` directly so that missing/invalid config fails fast at startup
 * with a clear error, and every value is fully typed.
 *
 * - Server-only vars go in `server`.
 * - Browser-exposed vars MUST be prefixed with `NEXT_PUBLIC_` and go in `client`.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Example server-only var — replace with your own (e.g. DATABASE_URL).
  // DATABASE_URL: z.string().url(),

  // Example client var — must start with NEXT_PUBLIC_ to reach the browser.
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    z.flattenError(parsed.error).fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
