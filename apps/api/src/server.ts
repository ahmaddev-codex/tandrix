import { serve } from "@hono/node-server";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app";
import { supabaseVerifier } from "./auth";
import { loadApiConfig } from "./config";
import { supabaseJobsRepo } from "./repos/jobs";

const config = loadApiConfig();
const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = createApp({
  verifyToken: supabaseVerifier(admin),
  jobs: supabaseJobsRepo(admin),
  corsOrigins: config.corsOrigins,
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Tandrix API (${config.env}) on http://localhost:${info.port}`);
});
