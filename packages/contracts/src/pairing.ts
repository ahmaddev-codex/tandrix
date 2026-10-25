// Signing the Mac in from the phone. The Mac shows a short code (as a QR); a signed-in phone
// approves it; the Mac, holding a separate poll token the QR never shows, collects a one-time
// sign-in for that user. Codes last two minutes and work once.
import { z } from "zod";
import { Id, Timestamp, text } from "./primitives";

/** Crockford base32: no I, L, O or U, so a code read aloud or typed can't be misread. */
export const PAIRING_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PAIRING_CODE_LENGTH = 8;
export const PAIRING_TTL_MS = 2 * 60_000;

/** Accepts what people type ("k7p4-qxj9", "K7P4 QXJ9", O for 0) and returns the canonical code. */
export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

export const PairingCode = z
  .string()
  .max(32)
  .transform(normalizePairingCode)
  .pipe(z.string().regex(new RegExp(`^[${PAIRING_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`)));

/** "K7P4QXJ9" → "K7P4-QXJ9", as the Mac shows it. */
export const formatPairingCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** The QR the Mac shows; the phone app opens it at its pair screen. */
export const pairingLink = (code: string) => `tandrix://pair?code=${code}`;

/** POST /pairing, signed out (the Mac). */
export const CreatePairingRequest = z.strictObject({ deviceName: text(80) });
export const CreatePairingResponse = z.strictObject({
  pairingId: Id,
  code: z.string().length(PAIRING_CODE_LENGTH),
  /** Kept by the Mac to collect the sign-in; never shown. */
  pollToken: z.string().min(32).max(128),
  expiresAt: Timestamp,
});
export type CreatePairingResponse = z.infer<typeof CreatePairingResponse>;

/** POST /pairing/lookup and /pairing/approve, signed in (the phone). */
export const PairingCodeRequest = z.strictObject({ code: PairingCode });
export const PairingLookupResponse = z.strictObject({
  deviceName: text(80),
  expiresAt: Timestamp,
});
export const PairingApproveResponse = z.strictObject({ deviceName: text(80) });

/** GET /pairing/:id with the poll token in X-Pairing-Token (the Mac). */
export const PairingStatusResponse = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("pending"), expiresAt: Timestamp }),
  /** A one-time sign-in for the approving user, exchanged with Supabase (verifyOtp). */
  z.strictObject({ status: z.literal("approved"), tokenHash: z.string().min(1).max(512) }),
  /** Expired, or already used: show a new code. */
  z.strictObject({ status: z.literal("expired") }),
]);
export type PairingStatusResponse = z.infer<typeof PairingStatusResponse>;
