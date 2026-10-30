"use client";
// Where you are, and what you're doing there: pick one of each and the picture shows Tandrix on it.
import { useState, type ReactNode } from "react";
import styles from "./Explorer.module.css";

export interface Place {
  name: string;
  tasks: Array<{ name: string; scene: ReactNode }>;
}

export function Explorer({ places }: { places: Place[] }) {
  const [p, setP] = useState(0);
  const [t, setT] = useState(0);
  const place = places[p]!;
  const task = place.tasks[Math.min(t, place.tasks.length - 1)]!;
  return (
    <div className={styles.wrap}>
      <div className={styles.list}>
        <h3>Where</h3>
        <ul>
          {places.map((pl, i) => (
            <li key={pl.name}>
              <button
                type="button"
                aria-pressed={i === p}
                onClick={() => {
                  setP(i);
                  setT(0);
                }}
              >
                {pl.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.stage}>
        <div className={styles.card}>
          <div key={`${p}-${t}`} className={styles.scene}>
            {task.scene}
          </div>
        </div>
      </div>
      <div className={styles.list}>
        <h3>Task</h3>
        <ul>
          {place.tasks.map((tk, i) => (
            <li key={tk.name}>
              <button type="button" aria-pressed={tk === task} onClick={() => setT(i)}>
                {tk.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
