import { PairingCode } from "@tandrix/contracts";

/** The code inside a scanned QR. Only Tandrix's own sign-in link counts. */
export function codeFromScan(data: string): string | null {
  const m = /^tandrix:\/\/pair\?code=([A-Za-z0-9-]{1,32})$/.exec(data.trim());
  const parsed = m ? PairingCode.safeParse(m[1]) : null;
  return parsed?.success ? parsed.data : null;
}
