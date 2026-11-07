// Settings: how Tandrix helps, how it listens, what it calls you, and the account. Its own page, so
// asking stays front and centre on the main one. Each group is a card of rows: what the setting is
// on the left, its control on the right.
import {
  Button,
  ConfirmDialog,
  doItForMeConfirmation,
  Input,
  ModeToggle,
  Notice,
  Toggle,
} from "@tandrix/ui/web";
import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { isLocal } from "../lib/env";
import { wakeNameOf, type useShowMe } from "../lib/use-show-me";
import { loadWords, parseWords, saveWords } from "../lib/words";
import { quietAtNight, quietMode, setQuietAtNight, setQuietMode } from "../lib/loudness";
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
  // Your own words (VO5): saved as they're typed, used from the next question.
  const [words, setWords] = useState(() => loadWords().join(", "));
  const [quiet, setQuiet] = useState(quietMode);
  const [nameDraft, setNameDraft] = useState(s.wakeName);
  const [night, setNight] = useState(quietAtNight);
  const changeWords = (text: string) => {
    setWords(text);
    saveWords(parseWords(text));
  };

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
        <Group title="How Tandrix helps">
          <div className="panel-row panel-row-block">
            <div className="panel-row-text">
              <span className="panel-row-desc">
                {s.mode === "do"
                  ? "Do it for me: Tandrix does what you ask straight away, including when you say \u201cfor me\u201d. It still asks before paying, sending, deleting or changing security settings."
                  : "Show me: Tandrix points and explains, and you do it. When you ask it to do something it offers first and you say yes; saying \u201cfor me\u201d does it straight away."}
              </span>
            </div>
            <ModeToggle
              mode={s.mode}
              onChange={(next) => (next === "do" ? setConfirming(true) : void s.setMode("show"))}
            />
          </div>
        </Group>

        <Group title="Listening">
          <div className="panel-row">
            <Toggle
              label={`Wake word ("Hey ${s.wakeName}")`}
              description={
                s.wakeWord
                  ? "Heard on this Mac only. Nothing leaves it until you say Tandrix's name."
                  : "Off: hold ⌥⌘ to talk, or type."
              }
              checked={s.wakeWord}
              onChange={s.setWakeWord}
            />
          </div>
          {s.wakeWord ? (
            <div className="panel-row panel-row-block">
              <Input
                label="Name to wake it"
                value={nameDraft}
                onChange={(v) => {
                  setNameDraft(v);
                  s.setWakeName(v);
                }}
                hint={`Say "Hey ${s.wakeName}" or "Wake up ${s.wakeName}". One word; an everyday name is heard most reliably.`}
                error={wakeNameOf(nameDraft) ? undefined : "One word of letters, 3 to 20 long."}
              />
            </div>
          ) : null}
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
          <div className="panel-row">
            <Toggle
              label="Quiet mode"
              description="Tandrix speaks softly, for shared or quiet rooms."
              checked={quiet}
              onChange={(on) => {
                setQuiet(on);
                setQuietMode(on);
              }}
            />
          </div>
          <div className="panel-row">
            <Toggle
              label="Quieter at night"
              description="Softer from 10 pm to 7 am."
              checked={night}
              onChange={(on) => {
                setNight(on);
                setQuietAtNight(on);
              }}
            />
          </div>
        </Group>

        <Group title="Words to hear right">
          <div className="panel-row panel-row-block">
            <div className="panel-row-text">
              <span className="panel-row-desc">
                Names Tandrix should always hear right: people, apps, products. Kept on this Mac.
              </span>
            </div>
            <Input
              label="Words"
              value={words}
              onChange={changeWords}
              placeholder="Niamh, Pixelmator, Kubernetes"
              hint="Separate them with commas."
            />
          </div>
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
