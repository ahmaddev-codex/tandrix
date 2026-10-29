// System Settings on the Wi-Fi page, with Tandrix pointing at the network to join.
import { Ring, Win } from "./parts";
import s from "./Settings.module.css";

const side: Array<[string, string]> = [
  ["Wi-Fi", "tBlue"],
  ["Bluetooth", "tBlue"],
  ["Network", "tBlue"],
  ["Battery", "tGreen"],
  ["General", "tGray"],
  ["Appearance", "tInk"],
  ["Accessibility", "tBlue"],
  ["Control Centre", "tGray"],
  ["Displays", "tBlue"],
  ["Notifications", "tRed"],
  ["Sound", "tPink"],
  ["Focus", "tIndigo"],
];

function Bars({ n = 3 }: { n?: number }) {
  return (
    <span className={s.bars}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? s.barOn : undefined} />
      ))}
    </span>
  );
}

export function SettingsScene({ ring = true }: { ring?: boolean }) {
  return (
    <Win title="" app="settings">
      <div className={s.body}>
        <aside className={s.side}>
          <span className={s.search}>Search</span>
          <span className={s.account}>
            <i />
            <span>
              <b>Sam Rivera</b>
              <em>Apple Account</em>
            </span>
          </span>
          {side.map(([name, color]) => (
            <span key={name} className={name === "Wi-Fi" ? s.itemOn : s.item}>
              <i className={s[color]} />
              {name}
            </span>
          ))}
        </aside>
        <section className={s.pane}>
          <h4>Wi-Fi</h4>
          <div className={s.group}>
            <span className={s.row}>
              <span className={s.wifiIcon} />
              <b>Wi-Fi</b>
              <span className={s.toggle} />
            </span>
          </div>
          <p className={s.label}>Known network</p>
          <div className={s.group}>
            <span className={s.row}>
              <span className={s.netName}>Hallway</span>
              <span className={s.muted}>Not connected</span>
              <span className={s.lock} />
              <Bars n={2} />
            </span>
          </div>
          <p className={s.label}>Other networks</p>
          <div className={s.group}>
            <span className={s.row}>
              <span className={s.netName}>Home-5G</span>
              <span className={s.lock} />
              <Bars />
              <span className={s.joinWrap}>
                <span className={s.join}>Connect</span>
                {ring ? <Ring caption="Click Connect next to Home-5G" place="belowEnd" /> : null}
              </span>
            </span>
            <span className={s.row}>
              <span className={s.netName}>Neighbour</span>
              <span className={s.lock} />
              <Bars n={1} />
            </span>
            <span className={s.row}>
              <span className={s.netName}>Printer-Direct</span>
              <Bars n={2} />
            </span>
          </div>
        </section>
      </div>
    </Win>
  );
}
