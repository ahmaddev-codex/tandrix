// Settings: how Tandrix helps, how it listens, what it calls you, and the account. Its own page, so
// asking stays front and centre on the main one. Each group is a card of rows: what the setting is
// on the left, its control on the right.
import {
  Button,
  ConfirmDialog,
  doItForMeConfirmation,
  Input,
  Notice,
  Toggle,
} from "@tandrix/ui/web";
import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { isLocal } from "../lib/env";
import type { useShowMe } from "../lib/use-show-me";
import { VoiceSetup } from "./VoiceSetup";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel-group" aria-label={title}>
      <h2 className="panel-group-title">{title}</h2>
      <div className="panel-card">{children}</div>
    </section>
  );
}

/** One row of a card: what it is (and a line on it), and its control. */
function Row({
  title,
  desc,
  children,
}: {
  title: ReactNode;
  desc?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="panel-row">
      <div className="panel-row-text">
        <span className="panel-row-title">{title}</span>
        {desc ? <span className="panel-row-desc">{desc}</span> : null}
      </div>
      {children}
    </div>
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

  const openSite = (e: FormEvent) => {
    e.preventDefault();
    const typed = site.trim();
    if (!typed) return;
    const url = /^https?:\/\//i.test(typed)
      ? typed.replace(/^http:/i, "https:")
      : `https://${typed}`;
    void window.tandrix.browser.signIn(url);
    setSite("");
  };

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

      <div className="panel-settings-body">
        <Group title="Doing things for you">
          <div className="panel-row">
            <Toggle
              label="Always do things without asking first"
              description="Off: Tandrix offers first, and you say yes. Either way it asks before paying, sending, deleting or changing security settings."
              checked={s.mode === "do"}
              onChange={(on) => (on ? setConfirming(true) : void s.setMode("show"))}
            />
          </div>
        </Group>

        <Group title="Listening">
          <div className="panel-row">
            <Toggle
              label='Wake word ("Hey Tandrix")'
              description={
                s.wakeWord
                  ? "Heard on this Mac only. Nothing leaves it until you say Tandrix's name."
                  : "Off: hold ⌥⌘ to talk, or type."
              }
              checked={s.wakeWord}
              onChange={s.setWakeWord}
            />
          </div>
          {s.wakeWord && s.wakeStatus.status === "unavailable" ? (
            <div className="panel-row">
              <Notice tone="attention">
                {s.wakeStatus.message ?? "The wake word can't listen right now."}
              </Notice>
            </div>
          ) : s.wakeWord ? (
            <div className="panel-row panel-row-block">
              <VoiceSetup listening={s.wakeStatus.status === "listening"} />
            </div>
          ) : null}
        </Group>

        <Group title="Tandrix's browser">
          <div className="panel-row panel-row-block">
            <div className="panel-row-text">
              <span className="panel-row-title">Sign in to sites</span>
              <span className="panel-row-desc">
                Background tasks use websites in a browser of their own, out of sight. Sign in once
                to the sites you want them to use; your own browser isn&rsquo;t touched.
              </span>
            </div>
            <form className="panel-inline-form" onSubmit={openSite}>
              <Input label="Site" value={site} onChange={setSite} placeholder="mail.google.com" />
              <Button type="submit" variant="secondary" disabled={!site.trim()}>
                Open
              </Button>
            </form>
          </div>
        </Group>

        <Group title="You">
          <div className="panel-row panel-row-block">{name}</div>
        </Group>

        <Group title="Account">
          <Row title="Signed in" desc={auth.session?.user.email}>
            <Button size="sm" variant="secondary" onClick={() => void auth.signOut()}>
              Sign out
            </Button>
          </Row>
        </Group>

        {isLocal ? (
          <Group title="Development">
            <Row title="Pointer" desc="Shows Tandrix's pointer on screen once.">
              <Button
                size="sm"
                variant="secondary"
                icon="pointer"
                onClick={() => void window.tandrix.overlay.testPointer()}
              >
                Test
              </Button>
            </Row>
          </Group>
        ) : null}
      </div>

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
    </main>
  );
}
