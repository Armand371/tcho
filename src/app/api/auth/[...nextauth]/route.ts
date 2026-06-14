// Auth.js OAuth/OIDC + session endpoints (sign-in, callback, sign-out, session).
// The handlers are defined once in `src/auth.ts`; this file just exposes them.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
