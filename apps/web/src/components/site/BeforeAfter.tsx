"use client";
// Before and after: a page of the real manual, and the step Tandrix makes from it. Drag the handle
// (or use the arrow keys on it) to compare.
import { useState } from "react";
import { Photo } from "../scenes/Photo";
import { sensorPhoto } from "../scenes/photos";
import styles from "./BeforeAfter.module.css";

export function BeforeAfter() {
  const [x, setX] = useState(50);
  return (
    <div className={styles.wrap}>
      <div className={styles.frame} style={{ ["--x" as string]: `${x}%` }}>
        {/* After: the step card Tandrix writes from that page. */}
        <div className={styles.after} aria-hidden="true">
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.chip}>To do</span>
              <span className={styles.meta}>Step 4 of 9 · Manual p. 4</span>
            </div>
            <b className={styles.title}>Fit the ultrasonic sensor</b>
            <div className={styles.cardShot}>
              <Photo spec={sensorPhoto} />
            </div>
            <ol className={styles.steps}>
              <li>Clip the sensor onto the front of the chassis.</li>
              <li>Plug its cable into port 3 on the main board.</li>
              <li>Take a photo when it’s on. Tandrix checks it.</li>
            </ol>
          </div>
        </div>
        {/* Before: the manual as printed. */}
        <div className={styles.before} aria-hidden="true">
          <img src="/photos/robot-manual.jpeg" alt="" />
        </div>
        <span className={styles.handle} aria-hidden="true">
          <i />
        </span>
        <span className={`${styles.tag} ${styles.tagLeft}`}>The manual</span>
        <span className={`${styles.tag} ${styles.tagRight}`}>Tandrix’s step</span>
        <input
          type="range"
          min={0}
          max={100}
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
          className={styles.range}
          aria-label="Compare the manual page with Tandrix's step"
        />
      </div>
    </div>
  );
}
