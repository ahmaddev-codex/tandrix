import type { SupabaseClient } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import { unauthorized } from "./errors";

export interface AuthUser {
  id: string;
}

export type VerifyToken = (token: string) => Promise<AuthUser | null>;

/** Verifies a Supabase access token against the project's published signing keys (JWKS). */
export function supabaseVerifier(admin: SupabaseClient): VerifyToken {
  return async (token) => {
    const { data, error } = await admin.auth.getClaims(token);
    if (error || !data?.claims?.sub || data.claims.role !== "authenticated") return null;
    return { id: data.claims.sub };
  };
}

export type AuthEnv = { Variables: { user: AuthUser } };

export const requireUser = (verify: VerifyToken) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const m = /^Bearer\s+(\S+)$/i.exec(header);
    if (!m) throw unauthorized();
    const user = await verify(m[1]!);
    if (!user) throw unauthorized();
    c.set("user", user);
    await next();
  });
