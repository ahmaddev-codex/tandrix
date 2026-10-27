// The hero: a real photo through the phone's camera with the outlines Tandrix's part finder drew
// on it in a live run, each part's label, and the step they're for. Styled as the design system's
// highlight (blue stroke, white halo, black keyline). The outlines trace once on load.
import { StepCard } from "@tandrix/ui/web";
import Image from "next/image";
import { heroParts, heroPhoto } from "../content/hero-highlight";
import styles from "./Viewfinder.module.css";

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function Viewfinder() {
  return (
    <figure
      className={styles.viewfinder}
      aria-label="Tandrix outlining a Raspberry Pi 5 and its Active Cooler on a phone's camera"
    >
      <div className={styles.frame}>
        <Image
          src={heroPhoto.src}
          alt="A Raspberry Pi 5 with an Active Cooler fitted, on a bamboo mat"
          width={heroPhoto.width}
          height={heroPhoto.height}
          priority
          sizes="(max-width: 900px) 100vw, 640px"
          className={styles.photo}
        />
        <svg
          className={styles.overlay}
          viewBox={`0 0 ${heroPhoto.width} ${heroPhoto.height}`}
          aria-hidden
        >
          {heroParts.map((p, i) => (
            <g
              key={p.label}
              transform={`translate(${p.box.x} ${p.box.y}) scale(${p.box.w / p.raster.width} ${p.box.h / p.raster.height})`}
              className={styles.part}
              style={{ animationDelay: `${0.35 + i * 0.5}s` }}
            >
              <path d={p.path} className={styles.tint} fillRule="evenodd" />
              <path
                d={p.path}
                className={styles.keyline}
                vectorEffect="non-scaling-stroke"
                pathLength={1}
              />
              <path
                d={p.path}
                className={styles.halo}
                vectorEffect="non-scaling-stroke"
                pathLength={1}
              />
              <path
                d={p.path}
                className={styles.stroke}
                vectorEffect="non-scaling-stroke"
                pathLength={1}
              />
            </g>
          ))}
        </svg>
        {heroParts.map((p, i) => (
          <span
            key={p.label}
            className={styles.label}
            style={{
              left: pct(p.box.x + (i ? p.box.w * 0.55 : 20), heroPhoto.width),
              top: pct(p.box.y + (i ? -8 : 20), heroPhoto.height),
              animationDelay: `${1.5 + i * 0.25}s`,
            }}
          >
            <span className={styles.dot} aria-hidden />
            {p.label}
          </span>
        ))}
        <span className={styles.corners} aria-hidden />
        <span className={styles.hud} aria-hidden>
          Both parts found
        </span>
      </div>
      <div className={styles.card}>
        <StepCard
          index={2}
          total={5}
          title="Fit the Active Cooler"
          body="Line the pins up with the two holes beside the processor and press both down until they click."
          status="progress"
          source="Manual p.4"
        />
      </div>
    </figure>
  );
}
