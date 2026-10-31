/**
 * Test tooling for the phone's end-to-end flows: deletes the projects earlier runs made for the
 * local test user (titled "<flow> e2e <run>" by run.sh, or "Pi 5 e2e <n>" by e2e:seed), with their
 * photos, the same way deleting a project in the app does. Other projects are left alone. Local
 * database only.
 *   pnpm --filter @tandrix/api e2e:clean
 * Prints how many projects it deleted.
 */
import { createClient } from "@supabase/supabase-js";
import { supabaseEvidenceRepo, supabaseEvidenceStorage } from "../src/repos/evidence";
import { supabaseJobsRepo } from "../src/repos/jobs";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const url = env("SUPABASE_URL");
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("Local database only.");
const db = createClient(url, env("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = env("DEV_USER_EMAIL");
const { data: users, error } = await db.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const owner = users.users.find((u) => u.email === email);
if (!owner) throw new Error(`No local user ${email}.`);

/** A title the flows or the seed gave a project: "<anything> e2e <digits>". */
const E2E_TITLE = /^\S.* e2e \d+$/;

const { data: rows, error: listError } = await db
  .from("jobs")
  .select("id, title")
  .eq("owner_id", owner.id)
  .like("title", "% e2e %");
if (listError) throw listError;
const doomed = rows.filter((r) => E2E_TITLE.test(r.title));

const jobs = supabaseJobsRepo(db);
const evidence = supabaseEvidenceRepo(db);
const storage = supabaseEvidenceStorage(db);
for (const { id } of doomed) {
  // Photos first: if one can't go, the project stays and the next run tries again.
  const keys = await evidence.keysForJob(id);
  await Promise.all(keys.map((key) => storage.remove(key)));
  await jobs.remove(owner.id, id);
}
console.log(`Deleted ${doomed.length} e2e ${doomed.length === 1 ? "project" : "projects"}.`);
