"use client";
// Early access while the apps aren't public yet: an email and which device, sent to the API. Every
// Get-Tandrix button leads here until real download links are set.
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";

const box =
  "mx-auto mb-[clamp(40px,5vw,64px)] grid w-[min(560px,100%)] scroll-mt-6 justify-items-center gap-3.5 rounded-3xl bg-paper p-6 text-center shadow-[0_0_0_1px_var(--line),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)]";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

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
      <div id="early" className={box} role="status">
        <p className="text-[22px] font-medium tracking-[-0.02em]">You’re on the list.</p>
        <p className="text-[13px] text-text-2">
          We’ll email {email.trim()} when Tandrix for {platform === "mac" ? "Mac" : "iPhone"} is
          ready for you.
        </p>
      </div>
    );
  }

  return (
    <form id="early" className={box} onSubmit={submit} noValidate>
      <p className="text-xl font-medium tracking-[-0.02em]">Get early access</p>
      <div className="inline-flex rounded-full bg-mist p-1" role="radiogroup" aria-label="Device">
        {(["mac", "iphone"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={platform === p}
            onClick={() => setPlatform(p)}
            className={cn(
              "min-h-9 min-w-[92px] cursor-pointer rounded-full border-0 bg-transparent px-4 text-sm font-medium text-text-2 aria-checked:bg-paper aria-checked:text-ink aria-checked:shadow-[0_1px_3px_rgba(0,0,0,0.12)]",
              focus,
            )}
          >
            {p === "mac" ? "Mac" : "iPhone"}
          </button>
        ))}
      </div>
      <div className="flex w-full flex-col gap-2 min-[481px]:flex-row">
        <label className="flex-1">
          <span className="sr-only">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className={cn(
              "min-h-12 w-full rounded-full border-0 bg-mist px-[18px] text-base text-ink shadow-[inset_0_0_0_1px_var(--line)]",
              focus,
            )}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state.kind === "error") setState({ kind: "idle" });
            }}
          />
        </label>
        <button
          type="submit"
          className={cn(
            "min-h-12 cursor-pointer rounded-full border-0 bg-ink px-[22px] text-[15px] font-medium text-page disabled:cursor-default disabled:opacity-50",
            focus,
          )}
          disabled={state.kind === "sending" || !email.trim()}
        >
          {state.kind === "sending" ? "Sending…" : "Notify me"}
        </button>
      </div>
      <p
        className={cn("text-[13px]", state.kind === "error" ? "text-(--red-900)" : "text-text-2")}
        aria-live="polite"
      >
        {state.kind === "error"
          ? state.message
          : "One email when it’s ready for your device. Nothing else."}
      </p>
    </form>
  );
}
