// The hero carousel's cards: each one idea, readable at a glance, as on the reference. Real photos
// and footage of people at it, between the moments Tandrix shows on screen.
import { BrandMark } from "@tandrix/ui/web";
import { Clip } from "@/components/ui/Clip";
import t from "./Tiles.module.css";

export function PhotoTile({
  src,
  at = "50% 50%",
  label,
}: {
  src: string;
  at?: string;
  label: string;
}) {
  return (
    <div className={t.tile}>
      <img src={src} alt="" loading="lazy" className={t.video} style={{ objectPosition: at }} />
      <span className={t.label}>{label}</span>
    </div>
  );
}

export function VideoTile({ name, label }: { name: string; label: string }) {
  return (
    <div className={t.tile}>
      <Clip name={name} className={t.video} />
      <span className={t.label}>{label}</span>
    </div>
  );
}

/** Listening: the pill, the waveform, and what was said. */
export function ListeningTile() {
  return (
    <div className={`${t.tile} ${t.dark}`}>
      <span className={t.pill}>
        <i className={t.dot} /> Listening <kbd>⌥⌘</kbd>
      </span>
      <span className={t.wave}>
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${(i % 8) * 90}ms` }} />
        ))}
      </span>
      <p className={t.said}>“Teach me pivot tables”</p>
    </div>
  );
}

/** A step checked from a photo. */
export function VerifiedTile() {
  return (
    <div className={`${t.tile} ${t.light}`}>
      <span className={t.kicker}>Step 3 of 6</span>
      <span className={t.bigCheck}>
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <b className={t.title}>Verified</b>
      <span className={t.sub}>Cooler seated on all four posts</span>
    </div>
  );
}

/** The keys you hold to talk. */
export function KeysTile() {
  return (
    <div className={`${t.tile} ${t.blue}`}>
      <span className={t.kicker}>Any app</span>
      <span className={t.keys}>
        <kbd>⌥</kbd>
        <kbd>⌘</kbd>
      </span>
      <span className={t.sub}>Hold to talk. Let go to ask.</span>
    </div>
  );
}

/** Do it for me: what Tandrix has done, and what it asks first. */
export function DoingTile() {
  return (
    <div className={`${t.tile} ${t.dark}`}>
      <span className={t.kicker}>Do it for me</span>
      <ul className={t.steps}>
        <li className={t.done}>Open Calendar</li>
        <li className={t.done}>Thursday, 10:00</li>
        <li className={t.done}>Dentist</li>
        <li className={t.next}>Send invite? Asks you</li>
      </ul>
    </div>
  );
}

/** A safety gate: the step waits for you. */
export function GateTile() {
  return (
    <div className={`${t.tile} ${t.light}`}>
      <span className={t.warn}>!</span>
      <b className={t.title}>Unplug it first</b>
      <span className={t.sub}>The next step waits until you say it’s safe.</span>
      <span className={t.toggle}>
        <i />
        It’s unplugged
      </span>
    </div>
  );
}

/** The mark, as the carousel's anchor card. */
export function MarkTile() {
  return (
    <div className={`${t.tile} ${t.mark}`}>
      <BrandMark size={64} />
      <span className={t.sub}>Tandrix is active</span>
    </div>
  );
}
