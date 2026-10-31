// First run on the Mac: what to call the user, screen access, the microphone, holding ⌥⌘ to
// talk, and one question.
import { Button, Icon, Input } from "@tandrix/ui/web";
import { useCallback, useEffect, useState } from "react";
import { TALK_KEYS, type ScreenAccess } from "../../shared/bridge";
import { api } from "../lib/api";
import { markNamed, readNamed, skipSetup, useSetupFlags } from "../lib/setup";

interface Item {
  title: string;
  body: string;
  done: boolean;
  action?: { label: string; run: () => void };
}

export function useSetupStatus() {
  const flags = useSetupFlags();
  const [screen, setScreen] = useState<ScreenAccess>();
  const [mic, setMic] = useState<ScreenAccess>();
  const [keys, setKeys] = useState<boolean>();
  const refresh = useCallback(() => {
    void window.tandrix.screen.access().then(setScreen);
    void window.tandrix.voice.micStatus().then(setMic);
    void window.tandrix.voice.talkKeysAccess(false).then(setKeys);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  const done = screen === "granted" && mic === "granted" && !!keys && flags.tried;
  return {
    screen,
    mic,
    keys,
    refresh,
    flags,
    done,
    show: !done && !flags.skipped && !!screen && !!mic && keys !== undefined,
  };
}

/** Asked once during setup (and never again): what Tandrix should call the user. */
function NameAsk() {
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (readNamed()) return;
    api
      .getProfile()
      .then((p) => {
        if (p.displayName) markNamed();
        else setShow(true);
      })
      .catch(() => undefined);
  }, []);
  if (!show) return null;
  const save = () => {
    const displayName = name.trim();
    if (!displayName) return;
    setSaving(true);
    api
      .updateProfile({ displayName })
      .then(() => {
        markNamed();
        setShow(false);
      })
      .catch(() => setSaving(false));
  };
  const skip = () => {
    markNamed();
    setShow(false);
  };
  return (
    <div className="panel-stack-2">
      <Input
        label="What should Tandrix call you?"
        value={name}
        onChange={setName}
        placeholder="Your first name"
        hint="First name is fine. Tandrix uses it rarely, so it feels personal."
      />
      <div className="setup-name-actions">
        <Button variant="primary" size="sm" onClick={save} disabled={saving || !name.trim()}>
          Save
        </Button>
        <Button variant="tertiary" size="sm" onClick={skip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

export function Setup({ status }: { status: ReturnType<typeof useSetupStatus> }) {
  const { screen, mic, keys, refresh, flags } = status;
  const items: Item[] = [
    {
      title: "Let Tandrix see your screen",
      body:
        screen === "denied"
          ? "Turn on Tandrix under Screen Recording in System Settings, then reopen Tandrix."
          : "So it can see the app you're in and point at the right control.",
      done: screen === "granted",
      action: {
        label: screen === "not-determined" ? "Allow screen access" : "Open System Settings",
        run: () => void window.tandrix.screen.openSettings().then(refresh),
      },
    },
    {
      title: "Let Tandrix hear you",
      body:
        mic === "denied"
          ? "Turn on Tandrix under Microphone in System Settings. You can still type questions."
          : "So you can ask out loud while your hands are on the keyboard and mouse.",
      done: mic === "granted",
      action: {
        label: "Allow microphone",
        run: () => void window.tandrix.voice.micAccess().then(refresh),
      },
    },
    {
      title: `Hold ${TALK_KEYS} to talk`,
      body: `Turn on Tandrix under Accessibility in System Settings, so holding ${TALK_KEYS} works in any app. Tandrix only notices those two keys.`,
      done: !!keys,
      action: {
        label: "Allow in Accessibility",
        run: () => void window.tandrix.voice.talkKeysAccess(true).then(refresh),
      },
    },
    {
      title: "Ask your first question",
      body: `In any app, hold ${TALK_KEYS}, ask "How do I…?", and let go. Or type below.`,
      done: flags.tried,
    },
  ];
  const next = items.findIndex((i) => !i.done);
  return (
    <section className="panel-stack-4 setup" aria-labelledby="setup-title">
      <header className="panel-stack-1">
        <h2 className="heading-16" id="setup-title">
          Set up Tandrix
        </h2>
        <p className="copy-13 panel-muted">Four things, about a minute.</p>
      </header>
      <NameAsk />
      <ol className="setup-list">
        {items.map((item, i) => (
          <li key={item.title} className={item.done ? "setup-item is-done" : "setup-item"}>
            <span className="setup-mark" aria-hidden>
              {item.done ? <Icon name="sealCheck" size={20} weight="fill" /> : i + 1}
            </span>
            <span className="panel-stack-1">
              <span className="label-13">
                {item.title}
                {item.done ? <span className="visually-hidden"> (done)</span> : null}
              </span>
              {!item.done ? <span className="copy-13 panel-muted">{item.body}</span> : null}
              {!item.done && item.action && i === next ? (
                <span>
                  <Button variant="primary" size="sm" onClick={item.action.run}>
                    {item.action.label}
                  </Button>
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <Button variant="tertiary" size="sm" onClick={skipSetup}>
        Skip setup for now
      </Button>
    </section>
  );
}
