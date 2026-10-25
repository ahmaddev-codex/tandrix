import { Button, Input } from "@tandrix/ui/web";
import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { PairWithPhone } from "./PairWithPhone";

type Step = "phone" | "email" | "code" | "password";

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function SignIn() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => {
    if (!looksLikeEmail(email)) return setError("Enter an email address, like name@company.com.");
    void run(async () => {
      await auth.sendCode(email.trim());
      setCode("");
      setStep("code");
    });
  };

  const goTo = (next: Step) => () => {
    setError(undefined);
    setStep(next);
  };

  const submit = (fn: () => void) => (e: FormEvent) => {
    e.preventDefault();
    if (!busy) fn();
  };

  return (
    <main className="panel-page panel-signin">
      <header className="panel-stack-2">
        <h1 className="heading-18">Tandrix</h1>
        <p className="copy-13 panel-muted">
          {step === "phone"
            ? "Scan this with your phone's camera, or open Tandrix on your phone and choose Sign in a Mac."
            : step === "code"
              ? `We sent a 6-digit code to ${email.trim()}.`
              : step === "password"
                ? "Local test sign-in."
                : "Sign in with your email. We'll send you a code."}
        </p>
      </header>

      {step === "phone" ? (
        <div className="panel-stack-4">
          <PairWithPhone />
          <Button variant="tertiary" onClick={goTo("email")}>
            Sign in with email instead
          </Button>
        </div>
      ) : null}

      {step === "email" ? (
        <form className="panel-stack-4" onSubmit={submit(sendCode)} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={setEmail}
            placeholder="name@company.com"
            error={error}
          />
          <Button type="submit" variant="primary" block disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </Button>
          <Button variant="tertiary" onClick={goTo("phone")}>
            Sign in with your phone instead
          </Button>
          {auth.signInWithPassword ? (
            <Button variant="tertiary" onClick={goTo("password")}>
              Local test sign-in
            </Button>
          ) : null}
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className="panel-stack-4"
          onSubmit={submit(() => {
            if (code.length === 6) void run(() => auth.verifyCode(email.trim(), code));
          })}
          noValidate
        >
          <Input
            label="Code"
            autoComplete="one-time-code"
            inputMode="numeric"
            autoFocus
            mono
            value={code}
            onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            error={error}
          />
          <Button type="submit" variant="primary" block disabled={busy || code.length !== 6}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <Button variant="tertiary" disabled={busy} onClick={sendCode}>
            Send a new code
          </Button>
          <Button variant="tertiary" onClick={goTo("email")}>
            Use a different email
          </Button>
        </form>
      ) : null}

      {step === "password" && auth.signInWithPassword ? (
        <form
          className="panel-stack-4"
          onSubmit={submit(() => void run(() => auth.signInWithPassword!(email.trim(), password)))}
          noValidate
        >
          <p className="copy-13 panel-muted">
            Only on the local stack: signs in the seeded test user (DEV_USER_EMAIL and
            DEV_USER_PASSWORD in .env.local).
          </p>
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            error={error}
          />
          <Button type="submit" variant="primary" block disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <Button variant="tertiary" onClick={goTo("email")}>
            Back to email code
          </Button>
        </form>
      ) : null}
    </main>
  );
}
