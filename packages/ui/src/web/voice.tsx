// What Tandrix heard and what it said back. Shown as well as spoken.
import { Icon, SourceChip } from "./primitives";

export interface VoiceTurn {
  speaker: "you" | "tandrix";
  text: string;
  /** refusal: work Tandrix won't guide; general: not from the step or its manual. */
  kind?: "refusal" | "general";
}

export interface VoiceTranscriptProps {
  state?: "idle" | "listening" | "working";
  turns?: VoiceTurn[];
  /** How to send while listening; the Mac hotkey is tap to send, not hold. */
  listeningLabel?: string;
}

export function VoiceTranscript({
  state = "idle",
  turns = [],
  listeningLabel = "Listening. Let go to send.",
}: VoiceTranscriptProps) {
  const shown = turns.slice(-4);
  if (state === "idle" && !shown.length) return null;
  return (
    <section className="tx-voice" aria-live="polite" aria-label="Conversation">
      {shown.map((t, i) => (
        <div key={i} className="tx-voice-turn">
          <span className="tx-voice-who">{t.speaker === "you" ? "You" : "Tandrix"}</span>
          {t.kind === "refusal" ? (
            <p className="tx-voice-text tx-voice-refusal">
              <Icon name="stop" size={20} />
              <span>{t.text}</span>
            </p>
          ) : (
            <p className="tx-voice-text">{t.text}</p>
          )}
          {t.kind === "general" ? <SourceChip kind="generic" /> : null}
        </div>
      ))}
      {state === "listening" ? (
        <div className="tx-voice-state" role="status">
          <span className="tx-voice-dot" aria-hidden />
          {listeningLabel}
        </div>
      ) : state === "working" ? (
        <div className="tx-voice-state" role="status">
          <span className="tx-spinner" aria-hidden />
          Working it out
        </div>
      ) : null}
    </section>
  );
}
