// First run on the Mac: screen access, the microphone, and one question with the hotkey.
import { Button, Icon } from "@tandrix/ui/web";
import { useCallback, useEffect, useState } from "react";
import { ASK_KEYS, type ScreenAccess } from "../../shared/bridge";
import { skipSetup, useSetupFlags } from "../lib/setup";

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
  const refresh = useCallback(() => {
    void window.tandrix.screen.access().then(setScreen);
    void window.tandrix.voice.micStatus().then(setMic);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  const done = screen === "granted" && mic === "granted" && flags.tried;
  return { screen, mic, refresh, flags, done, show: !done && !flags.skipped && !!screen && !!mic };
}

export function Setup({ status }: { status: ReturnType<typeof useSetupStatus> }) {
  const { screen, mic, refresh, flags } = status;
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
      title: "Ask your first question",
      body: `Switch to any app, press ${ASK_KEYS}, ask "How do I…?", then press ${ASK_KEYS} again. Or type below.`,
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
        <p className="copy-13 panel-muted">Three things, about a minute.</p>
      </header>
      <ol className="setup-list">
        {items.map((item, i) => (
          <li key={item.title} className={item.done ? "setup-item is-done" : "setup-item"}>
            <span className="setup-mark" aria-hidden>
              {item.done ? <Icon name="check" /> : i + 1}
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
