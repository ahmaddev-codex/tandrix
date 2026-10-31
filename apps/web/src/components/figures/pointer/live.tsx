"use client";

// Moves the pointing console: the carriage rides the rail (x), the head rides the arm (y), the
// plunger drops to the control's height and the ring lights on the control. Server-built parts
// arrive as props; this only writes transforms on refs, never re-rendering per frame.
import * as React from "react";
import { translateAlong } from "@/vendor/anatomy/iso-kit";
import { spring, useInView, useLoop, useStillness, type Spring } from "@/vendor/anatomy/react/live";
import { at, HEIGHT, P, REST, TARGETS, WIDTH } from "./view";

const TOUR_EVERY = 2.8;
const IDLE_AFTER = 5;
const STIFF = 60;
const DAMP = 14;

interface Props {
  art: React.ReactNode;
  rings: React.ReactNode;
  rail: React.ReactNode;
  carriage: React.ReactNode;
  plunger: React.ReactNode;
  housing: React.ReactNode;
  arm: React.ReactNode;
  sled: React.ReactNode;
}

export function PointerLive({ art, rings, rail, carriage, plunger, housing, arm, sled }: Props) {
  const stage = React.useRef<HTMLDivElement>(null);
  const inView = useInView(stage);
  const still = useStillness();
  const carriageRef = React.useRef<SVGGElement>(null);
  const armRef = React.useRef<SVGGElement>(null);
  const headRef = React.useRef<SVGGElement>(null);
  const plungerRef = React.useRef<SVGGElement>(null);
  const sledRef = React.useRef<SVGGElement>(null);
  const ringsRef = React.useRef<SVGGElement>(null);

  const [active, setActive] = React.useState(0);
  const motion = React.useRef({
    x: { at: 0, rate: 0 } as Spring,
    y: { at: 0, rate: 0 } as Spring,
    z: { at: 0, rate: 0 } as Spring,
  });
  const tour = React.useRef({ clock: 0, idle: IDLE_AFTER });

  const target = TARGETS[active]!;
  React.useEffect(() => {
    for (const ring of ringsRef.current?.querySelectorAll<SVGGElement>("[data-ring]") ?? []) {
      if (ring.dataset.ring === target.id) ring.setAttribute("data-on", "");
      else ring.removeAttribute("data-on");
    }
    // The ring lights once the head has arrived, not before.
    ringsRef.current?.removeAttribute("data-arrived");
  }, [target]);

  const kick = useLoop((dt, calm) => {
    const m = motion.current;
    const goal = [target.at[0] - REST[0], target.at[1] - REST[1], target.at[2] - REST[2]] as const;
    const doneX = spring(m.x, goal[0], dt, STIFF, DAMP, calm);
    const doneY = spring(m.y, goal[1], dt, STIFF, DAMP, calm);
    const doneZ = spring(m.z, goal[2], dt, STIFF * 1.6, DAMP, calm);
    carriageRef.current?.setAttribute("transform", translateAlong(P, [m.x.at, 0, 0]));
    armRef.current?.setAttribute("transform", translateAlong(P, [m.x.at, 0, 0]));
    const head = translateAlong(P, [m.x.at, m.y.at, 0]);
    headRef.current?.setAttribute("transform", head);
    sledRef.current?.setAttribute("transform", head);
    plungerRef.current?.setAttribute("transform", translateAlong(P, [m.x.at, m.y.at, m.z.at]));
    const near = Math.hypot(goal[0] - m.x.at, goal[1] - m.y.at) < 3;
    if (near) ringsRef.current?.setAttribute("data-arrived", "");

    // The idle tour: when nobody has touched it for a while, visit the next control.
    const t = tour.current;
    t.idle += dt;
    if (t.idle >= IDLE_AFTER && !calm) {
      t.clock += dt;
      if (t.clock >= TOUR_EVERY) {
        t.clock = 0;
        setActive((i) => (i + 1) % TARGETS.length);
      }
    }
    const settled = doneX && doneY && doneZ;
    return !settled || (t.idle >= IDLE_AFTER && !calm);
  }, inView);

  const choose = (i: number) => {
    tour.current = { clock: 0, idle: 0 };
    setActive(i);
    kick();
  };
  React.useEffect(() => {
    if (inView) kick();
  }, [active, inView, still, kick]);

  return (
    <div ref={stage} className="iso-stage relative">
      <svg
        className="iso-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="A pointer on a gantry over a control panel, ringing the control you ask about"
        focusable="false"
      >
        {art}
        <g ref={ringsRef}>{rings}</g>
        {rail}
        <g ref={carriageRef}>{carriage}</g>
        <g ref={plungerRef}>{plunger}</g>
        <g ref={headRef}>{housing}</g>
        <g ref={armRef}>{arm}</g>
        <g ref={sledRef}>{sled}</g>
      </svg>
      <div className="absolute inset-0">
        {TARGETS.map((t, i) => {
          const [x, y] = at(t.at);
          return (
            <button
              key={t.id}
              type="button"
              className="absolute aspect-square min-w-9 -translate-1/2 rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
              aria-label={`Point at the ${t.name.toLowerCase()}`}
              aria-pressed={i === active}
              style={{
                left: `${(x / WIDTH) * 100}%`,
                top: `${(y / HEIGHT) * 100}%`,
                width: `${((t.r * 2.4) / WIDTH) * 100}%`,
              }}
              onPointerEnter={() => choose(i)}
              onFocus={() => choose(i)}
              onClick={() => choose(i)}
            />
          );
        })}
      </div>
      <p
        className="mx-auto mt-2 min-h-[1.5em] text-center text-[17px] text-text-2 [&_b]:mr-1.5 [&_b]:font-semibold [&_b]:text-ink"
        aria-live="polite"
      >
        <b>{target.name}</b> {target.says}
      </p>
    </div>
  );
}
