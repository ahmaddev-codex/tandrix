// Signed-out calls for signing the Mac in from the phone.
import { CreatePairingResponse, PairingStatusResponse } from "@tandrix/contracts";
import type { z } from "zod";
import { env } from "./env";

async function call<T>(path: string, schema: z.ZodType<T>, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new Error("Can't reach Tandrix. Check your connection and try again.");
  }
  if (res.status === 429) throw new Error("Too many codes. Wait a minute and try again.");
  if (!res.ok) throw new Error("Couldn't make a sign-in code. Try again.");
  return schema.parse(await res.json());
}

export const pairing = {
  create: (deviceName: string) =>
    call("/pairing", CreatePairingResponse, {
      method: "POST",
      body: JSON.stringify({ deviceName }),
    }),
  status: (pairingId: string, pollToken: string) =>
    call(`/pairing/${pairingId}`, PairingStatusResponse, {
      headers: { "X-Pairing-Token": pollToken },
    }),
};
