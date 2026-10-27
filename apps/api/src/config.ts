import { z } from "zod";

// host.docker.internal is this machine as seen from a container.
const isLocalUrl = (u: string) =>
  /^https?:\/\/(127\.0\.0\.1|localhost|host\.docker\.internal)(:\d+)?(\/|$)/.test(u);

const Env = z
  .object({
    TANDRIX_ENV: z.enum(["local", "production"]),
    SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    CORS_ORIGINS: z.string().default(""),
    TOKEN_SIGNING_SECRET: z.string().min(32, "TOKEN_SIGNING_SECRET must be at least 32 characters"),
    /** The models. Optional locally (model features then say they're unavailable); required in production. */
    META_API_KEY: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    // Never let a local run touch a hosted project, or production point at a laptop.
    if (e.TANDRIX_ENV === "local" && !isLocalUrl(e.SUPABASE_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message:
          "must point at this machine (localhost or host.docker.internal) when TANDRIX_ENV=local",
      });
    }
    if (e.TANDRIX_ENV === "production" && !e.META_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["META_API_KEY"],
        message: "is required in production: every guide, check and answer needs the models",
      });
    }
    if (
      e.TANDRIX_ENV === "production" &&
      (isLocalUrl(e.SUPABASE_URL) || !e.SUPABASE_URL.startsWith("https://"))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "must be a hosted https URL in production",
      });
    }
  });

export interface ApiConfig {
  env: "local" | "production";
  supabaseUrl: string;
  supabaseSecretKey: string;
  supabasePublishableKey: string;
  port: number;
  corsOrigins: string[];
  tokenSigningSecret: string;
}

export function loadApiConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const r = Env.safeParse(env);
  if (!r.success) {
    throw new Error(
      `Invalid API configuration: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const e = r.data;
  return {
    env: e.TANDRIX_ENV,
    supabaseUrl: e.SUPABASE_URL,
    supabaseSecretKey: e.SUPABASE_SECRET_KEY,
    supabasePublishableKey: e.SUPABASE_PUBLISHABLE_KEY,
    port: e.API_PORT,
    tokenSigningSecret: e.TOKEN_SIGNING_SECRET,
    corsOrigins: e.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
