// Signing the Mac in with the phone: show a short-lived code as a QR, wait for the phone to
// approve it, then exchange the one-time sign-in for a session.
import { formatPairingCode, pairingLink, type CreatePairingResponse } from "@tandrix/contracts";
import { Button, Notice } from "@tandrix/ui/web";
import { useCallback, useEffect, useRef, useState } from "react";
import { pairing } from "../lib/pairing";
import { supabase } from "../lib/supabase";
import { QrCode } from "./QrCode";

const POLL_MS = 1500;

type State =
  | { kind: "loading" }
  | { kind: "showing"; pairing: CreatePairingResponse }
  | { kind: "signing" }
  | { kind: "error"; message: string };

const remaining = (expiresAt: string) =>
  Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function PairWithPhone() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [left, setLeft] = useState(0);
  const busy = useRef(false);

  const renew = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const p = await pairing.create(await window.tandrix.device.name());
      setLeft(remaining(p.expiresAt));
      setState({ kind: "showing", pairing: p });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void renew();
  }, [renew]);

  // Wait for the phone while the panel is open; a code that runs out is replaced.
  useEffect(() => {
    if (state.kind !== "showing") return;
    const p = state.pairing;
    const tick = async () => {
      if (document.visibilityState !== "visible" || busy.current) return;
      setLeft(remaining(p.expiresAt));
      busy.current = true;
      try {
        const r = await pairing.status(p.pairingId, p.pollToken);
        if (r.status === "expired") return void renew();
        if (r.status === "approved") {
          setState({ kind: "signing" });
          const { error } = await supabase.auth.verifyOtp({
            token_hash: r.tokenHash,
            type: "magiclink",
          });
          // On success the session changes and the panel moves on by itself.
          if (error)
            setState({
              kind: "error",
              message: "Couldn't sign this Mac in. Show a new code and try again.",
            });
        }
      } catch {
        // A missed poll is retried on the next tick.
      } finally {
        busy.current = false;
      }
    };
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(timer);
  }, [state, renew]);

  if (state.kind === "error")
    return (
      <Notice
        tone="error"
        action={
          <Button variant="secondary" onClick={() => void renew()}>
            Show a new code
          </Button>
        }
      >
        {state.message}
      </Notice>
    );

  return (
    <div className="panel-stack-4 pair">
      {state.kind === "showing" ? (
        <>
          <QrCode
            value={pairingLink(state.pairing.code)}
            label={`Sign-in code ${formatPairingCode(state.pairing.code)}`}
          />
          <div className="panel-stack-1 pair-code">
            <span className="mono-13 pair-code-text">{formatPairingCode(state.pairing.code)}</span>
            <span className="label-12 panel-muted" role="timer">
              {left > 0 ? `New code in ${clock(left)}` : "Getting a new code…"}
            </span>
          </div>
        </>
      ) : (
        <p className="copy-13 panel-muted" role="status">
          {state.kind === "signing" ? "Signing in…" : "Getting a code…"}
        </p>
      )}
    </div>
  );
}
