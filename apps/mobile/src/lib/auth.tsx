import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isLocal } from "./env";
import { supabase } from "./supabase";
import { resetJobs } from "./jobs-store";

interface AuthState {
  /** undefined while the stored session loads; null when signed out. */
  session: Session | null | undefined;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  /** Local stack only: sign in the seeded test user without email. */
  signInWithPassword?: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Supabase error messages are developer-facing; map the ones users hit to plain language. */
function friendly(e: { message: string; status?: number; code?: string }): Error {
  if (e.status === 429 || e.code === "over_email_send_rate_limit") {
    return new Error("Wait a minute before asking for another code.");
  }
  if (e.code === "otp_expired" || /expired|invalid/i.test(e.message)) {
    return new Error("That code didn't work. Check it, or ask for a new one.");
  }
  if (e.code === "invalid_credentials") return new Error("Email or password is wrong.");
  return new Error("Couldn't sign in. Check your connection and try again.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // Another account's projects must not show for a moment after the next sign-in.
      if (event === "SIGNED_OUT") resetJobs();
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      async sendCode(email) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw friendly(error);
      },
      async verifyCode(email, code) {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
        if (error) throw friendly(error);
      },
      ...(isLocal
        ? {
            async signInWithPassword(email: string, password: string) {
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) throw friendly(error);
            },
          }
        : {}),
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
