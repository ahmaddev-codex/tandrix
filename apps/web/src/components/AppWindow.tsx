// A Mac app with Tandrix over it: the presence pill under the menu bar and the pointer on the
// control, captioned with the reply the real model gave for this screen in a test run. The app is
// a stand-in (an OS-writing utility), drawn here rather than a screenshot of someone's Mac.
import { PointerBuddy, PresenceBar, type PresenceBarProps } from "@tandrix/ui/web";
import styles from "./AppWindow.module.css";

export function AppWindow({
  presence,
  pointer,
}: {
  presence: PresenceBarProps;
  /** Where the pointer sits, in % of the screen, and what it says. */
  pointer?: { x: string; y: string; caption: string };
}) {
  return (
    <figure className={styles.screen} aria-label="Tandrix pointing at Choose storage in an app on a Mac">
      <div className={styles.menubar} aria-hidden>
        <span className={styles.apple} />
        <b>OS Writer</b>
        <span>File</span>
        <span>Edit</span>
        <span>Window</span>
        <span>Help</span>
      </div>
      <div className={styles.window}>
        <div className={styles.titlebar} aria-hidden>
          <i />
          <i />
          <i />
          <span>OS Writer</span>
        </div>
        <div className={styles.body}>
          <h3 className={styles.appTitle}>Write an operating system to a card</h3>
          <div className={styles.choices}>
            {[
              ["Device", "Raspberry Pi 5"],
              ["Operating system", "Raspberry Pi OS (64-bit)"],
              ["Storage", "Choose storage"],
            ].map(([k, v]) => (
              <div key={k} className={styles.choice}>
                <span>{k}</span>
                <span className={v === "Choose storage" ? styles.pick : styles.picked}>{v}</span>
              </div>
            ))}
          </div>
          <span className={styles.next}>Next</span>
        </div>
      </div>
      {/* The overlay's fixed positioning resolves to this frame (it has a transform). */}
      <div className={styles.overlay}>
        <PresenceBar {...presence} top={26} />
        {pointer ? <PointerBuddy x={pointer.x} y={pointer.y} caption={pointer.caption} /> : null}
      </div>
    </figure>
  );
}
