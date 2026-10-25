// Pairing codes for signing the Mac in from the phone. Every change is one guarded update, so a
// code is approved once and a pairing is used once, even with two pollers racing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";

export interface NewPairing {
  codeHash: string;
  pollHash: string;
  deviceName: string;
  expiresAt: string;
}

export interface PairingRow {
  id: string;
  deviceName: string;
  expiresAt: string;
  approved: boolean;
  consumed: boolean;
}

export interface PairingsRepo {
  /** Null when the code is already taken by a live pairing (try another). */
  create(p: NewPairing): Promise<{ id: string } | null>;
  /** A live, unapproved pairing by its code. */
  findOpen(codeHash: string, now: string): Promise<PairingRow | null>;
  /** Approves a live, unapproved pairing for the user; null when there is none. */
  approve(codeHash: string, userId: string, now: string): Promise<PairingRow | null>;
  /** The pairing the Mac is polling, if the poll token matches. */
  get(id: string, pollHash: string): Promise<PairingRow | null>;
  /** Marks an approved, unused pairing used and returns who approved it. */
  consume(id: string, pollHash: string, now: string): Promise<string | null>;
}

type Row = Record<string, unknown>;
const columns = "id, device_name, expires_at, approved_at, consumed_at";
const toRow = (r: Row): PairingRow => ({
  id: String(r.id),
  deviceName: String(r.device_name),
  expiresAt: new Date(String(r.expires_at)).toISOString(),
  approved: r.approved_at !== null,
  consumed: r.consumed_at !== null,
});

export function supabasePairingsRepo(db: SupabaseClient): PairingsRepo {
  return {
    async create(p) {
      // Old pairings are only clutter; clear them as new ones are made.
      await db
        .from("pairings")
        .delete()
        .lt("expires_at", new Date(Date.now() - 86_400_000).toISOString());
      const { data, error } = await db
        .from("pairings")
        .insert({
          code_hash: p.codeHash,
          poll_hash: p.pollHash,
          device_name: p.deviceName,
          expires_at: p.expiresAt,
        })
        .select("id")
        .single();
      if (error?.code === "23505") return null;
      if (error) throw dbError(error);
      return { id: String(data.id) };
    },
    async findOpen(codeHash, now) {
      const { data, error } = await db
        .from("pairings")
        .select(columns)
        .eq("code_hash", codeHash)
        .is("approved_at", null)
        .gt("expires_at", now)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toRow(data) : null;
    },
    async approve(codeHash, userId, now) {
      const { data, error } = await db
        .from("pairings")
        .update({ user_id: userId, approved_at: now })
        .eq("code_hash", codeHash)
        .is("approved_at", null)
        .gt("expires_at", now)
        .select(columns)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toRow(data) : null;
    },
    async get(id, pollHash) {
      const { data, error } = await db
        .from("pairings")
        .select(columns)
        .eq("id", id)
        .eq("poll_hash", pollHash)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toRow(data) : null;
    },
    async consume(id, pollHash, now) {
      const { data, error } = await db
        .from("pairings")
        .update({ consumed_at: now })
        .eq("id", id)
        .eq("poll_hash", pollHash)
        .not("approved_at", "is", null)
        .is("consumed_at", null)
        .gt("expires_at", now)
        .select("user_id")
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? String(data.user_id) : null;
    },
  };
}
