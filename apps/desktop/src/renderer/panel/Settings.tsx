// Settings: how Tandrix helps, how it listens, what it calls you, and the account. Kept off the main
// screen so asking stays front and centre.
import {
  Button,
  ConfirmDialog,
  doItForMeConfirmation,
  Input,
  Notice,
  Toggle,
} from "@tandrix/ui/web";
import { useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { isLocal } from "../lib/env";
import type { useShowMe } from "../lib/use-show-me";
import { VoiceSetup } from "./VoiceSetup";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel-settings-group" aria-label={title}>
      <h3 className="label-13 panel-muted">{title}</h3>
      <div className="panel-stack-3">{children}</div>
    </section>
  );
}

export function Settings({
  s,
  name,
  onBack,
}: {
  s: ReturnType<typeof useShowMe>;
  /** What Tandrix calls the user, with a way to change it. */
  name: ReactNode;
  onBack: () => void;
}) {
  const auth = useAuth();
  // Doing things without asking first is opt-in, and asks once (design system: Do it for me).
  const [confirming, setConfirming] = useState(false);
  const [site, setSite] = useState("");
  const siteUrl = /^https?:\/\//i.test(site.trim())
    ? site.trim().replace(/^http:/i, "https:")
    : `https://${site.trim()}`;

  return (
    <main className="panel-page panel-settings" aria-labelledby="settings-title">
      <header className="panel-settings-head">
        <Button size="sm" variant="tertiary" icon="chevronLeft" onClick={onBack}>
          Back
        </Button>
        <h1 className="heading-16" id="settings-title">
          Settings
        </h1>
      </header>
      <div className="panel-body panel-stack-6">
        <Group title="Doing things for you">
          <Toggle
            label="Always do things without asking first"
            checked={s.mode === "do"}
            onChange={(on) => (on ? setConfirming(true) : void s.setMode("show"))}
          />
          <p className="copy-12 panel-muted">
            Off: Tandrix offers, and you say yes. Either way it asks before paying, sending,
            deleting or changing security settings.
          </p>
        </Group>

        <Group title="Tandrix's browser">
          <p className="copy-12 panel-muted">
            Background tasks use websites in a browser of their own, out of sight, so your screen,
            mouse and keyboard stay yours. Sign in to the sites you want them to use; your own
            browser isn&rsquo;t touched.
          </p>
          <form
            className="panel-ask"
            onSubmit={(e) => {
              e.preventDefault();
              if (!site.trim()) return;
              void window.tandrix.browser.signIn(siteUrl);
              setSite("");
            }}
          >
            <Input
              label="Sign in to a site"
              value={site}
              onChange={setSite}
              placeholder="mail.google.com"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!site.trim()}>
              Open
            </Button>
          </form>
        </Group>

        <Group title="Listening">
          <Toggle label='Wake word ("Hey Tandrix")' checked={s.wakeWord} onChange={s.setWakeWord} />
          {s.wakeWord && s.wakeStatus.status === "unavailable" ? (
            <Notice tone="attention">
              {s.wakeStatus.message ?? "The wake word can't listen right now."}
            </Notice>
          ) : s.wakeWord ? (
            <>
              <p className="copy-12 panel-muted">
                Heard on this Mac only. Nothing leaves it until you say Tandrix&rsquo;s name.
              </p>
              <VoiceSetup listening={s.wakeStatus.status === "listening"} />
            </>
          ) : (
            <p className="copy-12 panel-muted">Off: hold ⌥⌘ to talk, or type.</p>
          )}
        </Group>

        <Group title="You">{name}</Group>

        <Group title="Account">
          {auth.session?.user.email ? (
            <p className="copy-13">Signed in as {auth.session.user.email}</p>
          ) : null}
          <div>
            <Button variant="secondary" onClick={() => void auth.signOut()}>
              Sign out
            </Button>
          </div>
        </Group>

        {isLocal ? (
          <Group title="Development">
            <div>
              <Button
                variant="secondary"
                icon="pointer"
                onClick={() => void window.tandrix.overlay.testPointer()}
              >
                Test the pointer
              </Button>
            </div>
          </Group>
        ) : null}

        {confirming ? (
          <ConfirmDialog
            {...doItForMeConfirmation}
            onConfirm={() => {
              setConfirming(false);
              void s.setMode("do");
            }}
            onCancel={() => setConfirming(false)}
          />
        ) : null}
      </div>
    </main>
  );
}
