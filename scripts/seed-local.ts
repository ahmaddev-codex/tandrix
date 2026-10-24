/**
 * Creates the local test user in the local Supabase stack.
 *   pnpm db:seed
 * Local only: refuses to run against anything but this machine.
 */
export {};

const url = process.env.SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const email = process.env.DEV_USER_EMAIL ?? "";
const password = process.env.DEV_USER_PASSWORD ?? "";

if (
  process.env.TANDRIX_ENV !== "local" ||
  !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)
) {
  console.error(
    "db:seed only runs against the local stack (TANDRIX_ENV=local, SUPABASE_URL on localhost).",
  );
  process.exit(1);
}
if (!secret || !email || !password) {
  console.error(
    "Missing SUPABASE_SECRET_KEY, DEV_USER_EMAIL or DEV_USER_PASSWORD. Run pnpm env:local first.",
  );
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Local tester" },
  }),
});

if (res.ok) {
  console.log(`Created ${email}. Password is DEV_USER_PASSWORD in .env.local.`);
} else {
  const body = (await res.json().catch(() => ({}))) as {
    msg?: string;
    message?: string;
    error_code?: string;
  };
  if (
    res.status === 422 &&
    /already|exists/i.test(`${body.error_code} ${body.msg} ${body.message}`)
  ) {
    console.log(`${email} already exists.`);
  } else {
    console.error(
      `Could not create ${email}: HTTP ${res.status} ${body.msg ?? body.message ?? ""}`,
    );
    process.exit(1);
  }
}
