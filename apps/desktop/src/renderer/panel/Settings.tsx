// Settings: how Tandrix helps, how it listens, what it calls you, and the account. Kept off the main
// screen so asking stays front and centre.
import { Button, ConfirmDialog, doItForMeConfirmation, Notice, Toggle } from "@tandrix/ui/web";
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

  return (
    <section className="panel-stack-6" aria-labelledby="settings-title">
      <header className="panel-settings-head">
        <Button size="sm" variant="tertiary" icon="chevronLeft" onClick={onBack}>
          Back
        </Button>
        <h2 className="heading-16" id="settings-title">
          Settings
        </h2>
      </header>

      <Group title="Doing things for you">
        <Toggle
          label="Always do things without asking first"
          checked={s.mode === "do"}
          onChange={(on) => (on ? setConfirming(true) : void s.setMode("show"))}
        />
        <p className="copy-12 panel-muted">
          Off: Tandrix offers, and you say yes. Either way it asks before paying, sending, deleting
          or changing security settings.
        </p>
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
    </section>
  );
}
