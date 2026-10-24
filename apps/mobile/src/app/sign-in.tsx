import { space } from "@tandrix/ui";
import { Button, Input, Text } from "@tandrix/ui/native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";

type Step = "email" | "code" | "password";

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export default function SignIn() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>("email");
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
    run(async () => {
      await auth.sendCode(email.trim());
      setCode("");
      setStep("code");
    });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: space["space-6"],
            gap: space["space-6"],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: space["space-2"] }}>
            <Text variant="heading-32">Tandrix</Text>
            <Text variant="field-body" color="text-secondary">
              {step === "code"
                ? `We sent a 6-digit code to ${email.trim()}.`
                : step === "password"
                  ? "Local test sign-in."
                  : "Sign in with your email. We'll send you a code."}
            </Text>
          </View>

          {step === "email" ? (
            <View style={{ gap: space["space-4"] }}>
              <Input
                testID="email"
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="name@company.com"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                returnKeyType="send"
                onSubmitEditing={sendCode}
                error={error}
              />
              <Button variant="primary" block disabled={busy} onPress={sendCode} testID="send-code">
                {busy ? "Sending…" : "Send code"}
              </Button>
              {auth.signInWithPassword ? (
                <Button
                  variant="tertiary"
                  size="lg"
                  onPress={() => {
                    setError(undefined);
                    setStep("password");
                  }}
                  testID="use-password"
                >
                  Local test sign-in
                </Button>
              ) : null}
            </View>
          ) : null}

          {step === "code" ? (
            <View style={{ gap: space["space-4"] }}>
              <Input
                testID="code"
                label="Code"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                mono
                autoFocus
                maxLength={6}
                error={error}
              />
              <Button
                variant="primary"
                block
                disabled={busy || code.length !== 6}
                onPress={() => run(() => auth.verifyCode(email.trim(), code))}
                testID="verify-code"
              >
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <Button variant="tertiary" size="lg" disabled={busy} onPress={sendCode}>
                Send a new code
              </Button>
              <Button
                variant="tertiary"
                size="lg"
                onPress={() => {
                  setError(undefined);
                  setStep("email");
                }}
              >
                Use a different email
              </Button>
            </View>
          ) : null}

          {step === "password" && auth.signInWithPassword ? (
            <View style={{ gap: space["space-4"] }}>
              <Text variant="copy-14" color="text-secondary">
                Only on the local stack: signs in the seeded test user (DEV_USER_EMAIL and
                DEV_USER_PASSWORD in .env.local).
              </Text>
              <Input
                testID="email"
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                testID="password"
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                error={error}
              />
              <Button
                variant="primary"
                block
                disabled={busy}
                onPress={() => run(() => auth.signInWithPassword!(email.trim(), password))}
                testID="password-sign-in"
              >
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <Button variant="tertiary" size="lg" onPress={() => setStep("email")}>
                Back to email code
              </Button>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
