// Short-lived HMAC tokens proving the server issued a value to a user (e.g. a manual URL its own
// search returned), so clients can't substitute arbitrary input.
import { createHmac, timingSafeEqual } from "node:crypto";

export function signToken(secret: string, fields: string[], expiresAt: number): string {
  const payload = `${expiresAt}`;
  const mac = createHmac("sha256", secret)
    .update([payload, ...fields].join("\n"))
    .digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyToken(
  secret: string,
  fields: string[],
  token: string,
  now = Date.now(),
): boolean {
  const [exp, mac] = token.split(".");
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  const expected = createHmac("sha256", secret)
    .update([exp, ...fields].join("\n"))
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
