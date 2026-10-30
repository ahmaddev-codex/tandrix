"use client";
// Early access while the apps aren't public yet: an email and which device, sent to the API. Every
// Get-Tandrix button leads here until real download links are set.
import { useState, type FormEvent } from "react";
import styles from "./EarlyAccess.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

type State =
  { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; message: string };

export function EarlyAccess() {
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<"mac" | "iphone">("mac");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      const res = await fetch(`${API}/early-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, platform }),
      });
      if (res.ok) return setState({ kind: "done" });
      setState({
        kind: "error",
        message:
          res.status === 400
            ? "That doesn't look like an email address. Check it and try again."
            : res.status === 429
              ? "Too many tries from here. Wait a minute, then try again."
              : "Tandrix couldn't save that right now. Try again in a moment.",
      });
    } catch {
      setState({
        kind: "error",
        message: "Couldn't reach Tandrix. Check your connection and try again.",
      });
    }
  };

  if (state.kind === "done") {
    return (
      <div id="early" className={styles.box} role="status">
        <p className={styles.done}>You’re on the list.</p>
        <p className={styles.note}>
          We’ll email {email.trim()} when Tandrix for {platform === "mac" ? "Mac" : "iPhone"} is
          ready for you.
        </p>
      </div>
    );
  }

  return (
    <form id="early" className={styles.box} onSubmit={submit} noValidate>
      <p className={styles.title}>Get early access</p>
      <div className={styles.seg} role="radiogroup" aria-label="Device">
        {(["mac", "iphone"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={platform === p}
            onClick={() => setPlatform(p)}
          >
            {p === "mac" ? "Mac" : "iPhone"}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.hidden}>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state.kind === "error") setState({ kind: "idle" });
            }}
          />
        </label>
        <button
          type="submit"
          className={styles.go}
          disabled={state.kind === "sending" || !email.trim()}
        >
          {state.kind === "sending" ? "Sending…" : "Notify me"}
        </button>
      </div>
      <p className={state.kind === "error" ? styles.error : styles.note} aria-live="polite">
        {state.kind === "error"
          ? state.message
          : "One email when it’s ready for your device. Nothing else."}
      </p>
    </form>
  );
}
