"use client";
// Try it: a spreadsheet, drawn in code. Over it your cursor becomes the Tandrix pointer, and the
// ring settles on whichever control you're near and says what it is. Every control is a real
// element, so the ring is always exactly on it. Without a mouse (touch), it tours by itself.
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { HearIt } from "./HearIt";
import styles from "./TryIt.module.css";

const rows = [
  ["North", "Kettles", "12,480", "13,920", "15,110"],
  ["North", "Toasters", "8,340", "7,910", "9,260"],
  ["South", "Kettles", "10,210", "11,450", "11,980"],
  ["South", "Toasters", "6,890", "7,340", "8,120"],
  ["East", "Kettles", "9,720", "10,880", "12,340"],
  ["East", "Toasters", "5,410", "6,020", "6,610"],
];
const bars = [62, 48, 70, 41, 78, 35];

export function TryIt() {
  const screen = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState<{ x: number; y: number; w: number; h: number; say: string; right: boolean } | null>(null);
  const [hovering, setHovering] = useState(false);
  const tour = useRef(0);

  /** Ring the element, in the screen's own coordinates. */
  const settle = useCallback((el: HTMLElement) => {
    const box = screen.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = r.left - box.left;
    setRing({
      x,
      y: r.top - box.top,
      w: r.width,
      h: r.height,
      say: el.dataset.say!,
      right: x + r.width / 2 > box.width / 2,
    });
  }, []);

  // No mouse over it: tour the controls, slowly.
  useEffect(() => {
    if (hovering) return;
    const targets = () => [...screen.current!.querySelectorAll<HTMLElement>("[data-say]")];
    const next = () => {
      const all = targets();
      settle(all[tour.current++ % all.length]!);
    };
    next();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(next, 2600);
    return () => clearInterval(t);
  }, [hovering, settle]);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    let best: HTMLElement | null = null;
    let bestD = Infinity;
    for (const el of screen.current!.querySelectorAll<HTMLElement>("[data-say]")) {
      const r = el.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const d = Math.hypot(dx, dy);
      if (d < bestD) [best, bestD] = [el, d];
    }
    if (best && best.dataset.say !== ring?.say) settle(best);
  };

  return (
    <div className={styles.wrap}>
      <div
        ref={screen}
        className={styles.screen}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onPointerMove={move}
        aria-hidden="true"
      >
        <div className={styles.bar}>
          <span className={styles.lights}>
            <i />
            <i />
            <i />
          </span>
          <span className={styles.title}>Q3 sales</span>
          <span className={styles.share} data-say="Share. Sends a link to this sheet.">
            Share
          </span>
        </div>
        <div className={styles.tabs}>
          <span>Home</span>
          <span className={styles.tabOn} data-say="Insert. Tables, charts and PivotTables live here.">
            Insert
          </span>
          <span>Formulas</span>
          <span data-say="Data. Sort, filter and remove duplicates.">Data</span>
          <span>View</span>
        </div>
        <div className={styles.ribbon}>
          <span className={styles.tool} data-say="PivotTable. Sums your data by region and product.">
            <i className={styles.iPivot} />
            PivotTable
          </span>
          <span className={styles.tool} data-say="Table. Turns this range into a sortable table.">
            <i className={styles.iTable} />
            Table
          </span>
          <span className={styles.tool} data-say="Chart. Draws the selected numbers as a chart.">
            <i className={styles.iChart} />
            Chart
          </span>
          <span className={styles.tool} data-say="Picture. Adds an image to the sheet.">
            <i className={styles.iPic} />
            Picture
          </span>
        </div>
        <div className={styles.body}>
          <table className={styles.grid} data-say="Your sales table. Totals update as you type.">
            <thead>
              <tr>
                <th>Region</th>
                <th>Product</th>
                <th>Jul</th>
                <th>Aug</th>
                <th>Sep</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.join()}>
                  {r.map((c, i) => (
                    <td key={i} className={i > 1 ? styles.num : undefined}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.chart} data-say="The chart of this table. Click a bar to edit its data.">
            <b>Sales by month</b>
            <div className={styles.bars}>
              {bars.map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
        {ring ? (
          <span
            className={styles.ring}
            style={{ left: ring.x - 5, top: ring.y - 5, width: ring.w + 10, height: ring.h + 10 }}
          >
            <span key={ring.say} className={`${styles.say} ${ring.right ? styles.sayRight : ""}`}>
              {ring.say}
            </span>
          </span>
        ) : null}
      </div>
      <div className={styles.side}>
        <p className={styles.hint}>
          <span className={styles.mouse} aria-hidden="true" />
          Move your pointer over the screen. Tandrix shows you what each thing is.
        </p>
        <HearIt line="pivot" label="Hear it say a step" tone="light" />
      </div>
    </div>
  );
}
