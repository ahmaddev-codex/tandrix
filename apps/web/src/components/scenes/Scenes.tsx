// The site's pictures of Tandrix at work, drawn in code so they stay sharp at any size: real-looking
// app windows (Excel, System Settings, Calendar), a printed manual page, the iPhone camera, and the
// small cards Tandrix shows. Decorative: each is aria-hidden and the copy beside it says what it
// shows.
import { Tick } from "./parts";
import s from "./Scenes.module.css";

export { CalendarScene } from "./Calendar";
export { ExcelScene } from "./Excel";
export { ManualScene } from "./Manual";
export { PointerArrow } from "./parts";
export { SettingsScene } from "./Settings";

/**
 * Real output: the parts Tandrix's segmenter outlined on this photo in one run (boxes in percent
 * of the image), and the part it couldn't find.
 */
const found: Array<{ name: string; box: [number, number, number, number] }> = [
  { name: "Hammer", box: [15.9, 17.9, 15.8, 51.8] },
  { name: "Cordless drill", box: [36.9, 35.2, 34.2, 39.3] },
  { name: "Pliers", box: [69.9, 73.2, 23.7, 10.4] },
  { name: "Pliers", box: [57.4, 58.5, 10.1, 15.9] },
];

/** The iPhone camera on a parts check: what Tandrix found, outlined, and what it didn't. */
export function PhoneScene() {
  return (
    <div className={s.phoneBox} aria-hidden="true">
      <div className={s.phone}>
        <span className={s.island} />
        <div className={s.screen}>
          <div className={s.status}>
            <b>9:41</b>
            <span>Parts check</span>
          </div>
          <div className={s.camera}>
            <img src="/photos/tools-flatlay.jpg" alt="" width={1800} height={1421} loading="lazy" />
            {found.map((f, i) => (
              <span
                key={i}
                className={s.partBox}
                style={{
                  left: `${f.box[0]}%`,
                  top: `${f.box[1]}%`,
                  width: `${f.box[2]}%`,
                  height: `${f.box[3]}%`,
                }}
              >
                {i < 3 ? <em>{f.name}</em> : null}
              </span>
            ))}
          </div>
          <div className={s.sheet}>
            <span className={s.grab} />
            <b>3 of 4 parts found</b>
            <span className={s.sheetRow}>
              <span className={s.ok}>
                <Tick />
              </span>
              Hammer, cordless drill, pliers
            </span>
            <span className={s.sheetRow}>
              <span className={s.ask}>?</span>
              Spirit level not found. Is it in the box?
            </span>
            <span className={s.sheetButton}>Next step</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A step checked from a photo, as the phone shows it. */
export function CheckCard() {
  return (
    <div className={s.card} aria-hidden="true">
      <div className={s.cardHead}>
        <span className={s.verified}>
          <Tick /> Verified
        </span>
        <span>Step 3 of 6</span>
      </div>
      <b className={s.cardTitle}>Fit the drill bit</b>
      <p>The bit is seated and the chuck is tight.</p>
      <span className={s.progress}>
        <i style={{ width: "50%" }} />
      </span>
    </div>
  );
}

/** A spoken exchange: what was asked and what Tandrix said back. */
export function VoiceCard({ ask, reply }: { ask: string; reply: string }) {
  return (
    <div className={s.voice} aria-hidden="true">
      <p className={s.you}>{ask}</p>
      <p className={s.reply}>
        <span className={s.wave}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        {reply}
      </p>
    </div>
  );
}

/** A safety gate: the step waits until the user confirms. */
export function GateCard() {
  return (
    <div className={s.card} aria-hidden="true">
      <span className={s.gateIcon}>!</span>
      <b className={s.cardTitle}>Before you continue</b>
      <p>Unplug the power. Tandrix waits until you say it&apos;s done.</p>
      <span className={s.gateButtons}>
        <span>Not yet</span>
        <span className={s.gateGo}>It&apos;s unplugged</span>
      </span>
    </div>
  );
}
