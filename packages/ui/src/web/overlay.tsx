"use client";
// Mac overlay and panel components: pointer, control state and the Show me / Do it for me switch.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ControlMode } from "../shared";
import { cx } from "./cx";
import { Button, Icon } from "./primitives";

export interface PointerBuddyProps {
  /** Position inside the overlay window, already mapped from screenshot pixels and display scale. */
  x: number | string;
  y: number | string;
  caption?: ReactNode;
  /**
   * An annotation's frame round what the answer is about, centred on the point, in points: drawn
   * out from its top-left corner like a frame in a design tool, with a name tag and a note.
   */
  box?: { width: number; height: number };
  /** A step number on the pointer, while teaching. */
  step?: number;
  /** The frame's name tag ("Equation"). */
  label?: string;
  /** Written beside it: an equation's working, the key point. */
  note?: string;
  /** How long it stays before fading, in milliseconds. */
  hold?: number;
  /** Each part marked up, centred `dx`, `dy` from the point: drawn one after another. */
  regions?: Array<{
    dx: number;
    dy: number;
    width: number;
    height: number;
    label: string;
    detail?: string;
    /** Where the pen touches the part, from its centre. */
    ax?: number;
    ay?: number;
    /** How it's marked, and the pen's strokes from the part's centre (flat x, y runs). */
    mark?: { kind: string; strokes: number[][] };
  }>;
}

const ARROW =
  "M4.9 3.3C3.7 2.8 2.8 3.7 3.3 4.9L9.1 19.3C9.6 20.6 11.5 20.5 11.9 19.1L13.2 15.1C13.5 14.1 14.1 13.5 15.1 13.2L19.1 11.9C20.5 11.5 20.6 9.6 19.3 9.1L4.9 3.3Z";
/** The note's width, to choose the side with room for it. */
const NOTE_WIDTH = 300;

/** What it writes beside the cursor: handwriting on the screen, no card. */
function Note({ text, side }: { text: string; side: "left" | "right" }) {
  return (
    <div className="tx-annot-note tx-writing" data-side={side} data-last>
      {text.split("\n").map((line, i) => (
        <span key={i} className="tx-writing-detail">
          {line}
        </span>
      ))}
    </div>
  );
}

/** Room for the handwriting beside a part. */
const WRITE_W = 210;
const WRITE_H = 44;

type Region = NonNullable<PointerBuddyProps["regions"]>[number];

/** The pen: the cursor, its tip at the point it's drawing. */
function Pen({ path, className }: { path: string; className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
      style={{ ["offsetPath" as string]: `path("${path}")` }}
    >
      <path d={ARROW} />
    </svg>
  );
}

/**
 * A hand-drawn line from where the pen touches a part out to where it writes: a gentle curve,
 * a little uneven, as a hand would draw it.
 */
export function penLine(ax: number, ay: number, tx: number, ty: number, seed: number): string {
  const mx = (ax + tx) / 2;
  const my = (ay + ty) / 2;
  // Bowed a little to one side, and up, never dead straight.
  const bow = 14 + (seed % 3) * 4;
  const cx = mx + (ty < ay ? -bow : bow) * 0.4;
  const cy = my - bow;
  return `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
}

/** A stroke as path commands: a smooth curve through its points (a trace, a loop), else lines. */
function strokePath(pts: Array<[number, number]>, smooth: boolean): string {
  if (!pts.length) return "";
  const f = (n: number) => n.toFixed(1);
  if (!smooth || pts.length < 3)
    return pts.map(([x, y], i) => `${i ? "L" : "M"} ${f(x)} ${f(y)}`).join(" ");
  // Through the midpoints, each point a control: smooth, and still on the drawing.
  let d = `M ${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]!;
    const [nx, ny] = pts[i + 1]!;
    d += ` Q ${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const last = pts.at(-1)!;
  return `${d} L ${f(last[0])} ${f(last[1])}`;
}

/** How long the pen takes over a mark: by its length, never rushed, never dragging. */
const drawTime = (pts: Array<[number, number]>) => {
  let len = 0;
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return Math.round(Math.max(420, Math.min(2200, len * 1.6)));
};

/**
 * Parts annotated as a teacher would on the screen, one at a time: the pen touches the part,
 * draws a line out from it and writes its name and what it does at the end of the line, the
 * cursor following every stroke exactly. No cards: marks and handwriting on the screen itself.
 */
function Diagram({
  x,
  y,
  hold,
  regions,
  note,
}: {
  x: number | string;
  y: number | string;
  hold?: number;
  regions: Region[];
  note?: string;
}) {
  const ox = typeof x === "number" ? x : 0;
  const oy = typeof y === "number" ? y : 0;
  const vw = typeof window === "undefined" ? 1e4 : window.innerWidth;
  const vh = typeof window === "undefined" ? 1e4 : window.innerHeight;
  const marks = regions.map((r, i) => {
    const cx = ox + r.dx;
    const cy = oy + r.dy;
    // The mark, in overlay points: its strokes, the path the pen follows, how long it takes.
    const strokes = (r.mark?.strokes ?? []).map((st) => {
      const pts: Array<[number, number]> = [];
      for (let k = 0; k + 1 < st.length; k += 2) pts.push([cx + st[k]!, cy + st[k + 1]!]);
      return pts;
    });
    const smooth = r.mark?.kind === "trace" || r.mark?.kind === "outline";
    const drawn = strokes.length ? strokes.map((st) => strokePath(st, smooth)).join(" ") : "";
    const all = strokes.flat();
    // Where the pen touches: the spot on the part, else its middle.
    const ax = cx + (r.ax ?? 0);
    const ay = cy + (r.ay ?? 0);
    // The words go just past the mark (or the part), on the side with room.
    const markRight = all.length ? Math.max(...all.map((p) => p[0])) : cx + r.width / 2;
    const markLeft = all.length ? Math.min(...all.map((p) => p[0])) : cx - r.width / 2;
    const rightmost = all.length ? all.reduce((a, p) => (p[0] > a[0] ? p : a)) : [ax, ay];
    const right = markRight + 18 + WRITE_W < vw - 8 || markLeft - 18 - WRITE_W < 8;
    const tx = right ? markRight + 16 : markLeft - 16;
    const top = Math.min(Math.max(rightmost[1]! - WRITE_H / 2 - 4, 8), vh - WRITE_H - 8);
    const ty = top + 12;
    const time = drawn ? drawTime(all) : 620;
    return {
      ...r,
      i,
      ax,
      ay,
      tx,
      ty,
      top,
      drawn,
      time,
      kind: r.mark?.kind,
      side: right ? ("right" as const) : ("left" as const),
    };
  });
  return (
    <div
      className="tx-diagram"
      style={{ ["--tx-hold" as string]: `${hold ?? 20_000}ms` }}
      role="status"
      aria-live="polite"
    >
      <svg className="tx-diagram-lines" width={vw} height={vh} aria-hidden>
        {marks.map((m) => {
          // The mark itself; without one, a line from the part out to the words.
          const d =
            m.drawn || penLine(m.ax, m.ay, m.tx + (m.side === "right" ? -4 : 4), m.ty, m.i + 1);
          return (
            <g
              key={m.i}
              data-kind={m.kind}
              style={{ ["--tx-delay" as string]: "0ms", ["--tx-draw" as string]: `${m.time}ms` }}
            >
              {m.kind !== "highlight" ? (
                <path className="tx-marker-halo" d={d} pathLength={1} />
              ) : null}
              <path className="tx-marker" d={d} pathLength={1} />
              {m.kind === "point" ? (
                <circle className="tx-touch" cx={m.ax} cy={m.ay} r={5} />
              ) : null}
            </g>
          );
        })}
      </svg>
      {marks.map((m) => {
        const d =
          m.drawn || penLine(m.ax, m.ay, m.tx + (m.side === "right" ? -4 : 4), m.ty, m.i + 1);
        return (
          <div
            key={m.i}
            style={{ ["--tx-delay" as string]: "0ms", ["--tx-draw" as string]: `${m.time}ms` }}
          >
            {/* The cursor drawing the line, its tip on the line's end as it grows. */}
            <Pen path={d} className="tx-pen tx-pen-line" />
            <div
              className="tx-writing"
              data-side={m.side}
              data-last={m.i === marks.length - 1 || undefined}
              style={{
                ...(m.side === "right" ? { left: m.tx } : { right: vw - m.tx }),
                top: m.top,
                maxWidth: WRITE_W,
              }}
            >
              <span className="tx-writing-name">{m.label}</span>
              {m.detail ? <span className="tx-writing-detail">{m.detail}</span> : null}
              <svg
                className="tx-writing-pen"
                viewBox="0 0 24 24"
                width={22}
                height={22}
                aria-hidden
              >
                <path d={ARROW} />
              </svg>
            </div>
          </div>
        );
      })}
      {note ? (
        <div
          className="tx-writing tx-writing-note"
          data-last
          style={{
            top: 8,
            left: Math.min(vw - WRITE_W - 8, Math.max(...marks.map((m) => m.tx)) + 40),
          }}
        >
          {note.split("\n").map((line, i) => (
            <span key={i} className="tx-writing-detail">
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PointerBuddy({ x, y, box, step, label, note, hold, regions }: PointerBuddyProps) {
  const style = { left: x, top: y, ["--tx-hold" as string]: `${hold ?? 15_000}ms` };
  if (regions?.length) return <Diagram x={x} y={y} hold={hold} regions={regions} note={note} />;
  // The note goes where there's room: right of what it's about, else left.
  const cx = typeof x === "number" ? x : 0;
  const half = box ? box.width / 2 : 0;
  const room = typeof window === "undefined" ? 1e4 : window.innerWidth;
  const side = cx + half + 24 + NOTE_WIDTH < room ? "right" : "left";
  if (box) {
    const w = Math.max(24, Math.round(box.width));
    const h = Math.max(16, Math.round(box.height));
    // The frame as one stroke round its edges from the top-left corner: the pen follows it.
    const edges = `M ${-w / 2} ${-h / 2} H ${w / 2} V ${h / 2} H ${-w / 2} Z`;
    return (
      <div
        className="tx-annot"
        style={{ ...style, ["--tx-w" as string]: `${w}px`, ["--tx-h" as string]: `${h}px` }}
        role="status"
        aria-live="polite"
      >
        <div className="tx-annot-frame">
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <span key={c} className="tx-annot-handle" data-corner={c} />
          ))}
        </div>
        <svg className="tx-annot-edges" width={1} height={1} aria-hidden>
          <path d={edges} pathLength={1} />
        </svg>
        {label ? <span className="tx-annot-tag">{label}</span> : null}
        <Pen path={edges} className="tx-pen tx-pen-frame" />
        {note ? <Note text={note} side={side} /> : null}
      </div>
    );
  }
  return (
    <div className="tx-ptr" style={style} role="status" aria-live="polite">
      <svg className="tx-ptr-arrow" viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
        <path d={ARROW} />
      </svg>
      {step ? <span className="tx-ptr-step">{step}</span> : null}
      {note ? <Note text={note} side={side} /> : null}
    </div>
  );
}

export type PresenceState = "listening" | "thinking" | "looking" | "answering" | "doing";

export interface PresenceBarProps {
  state: PresenceState;
  /** One short line: "Listening", "Looking at your screen". */
  label: string;
  /** The keys that end this state, shown as keycaps after the label ("⌃⇧"). */
  keys?: string;
  /** What to do with the keys: "Let go to ask". */
  keysHint?: string;
  /** Under the pill, at most two lines: what the user asked while thinking, the reply after. */
  text?: string;
  /** Microphone level while listening, 0 to 1. */
  level?: number;
  /** The menu bar's height (with the notch, on Macs that have one), from the window's top, in points. */
  top?: number;
  /** Going away: it retracts into the top edge. */
  leaving?: boolean;
}

const BARS = [0.55, 0.85, 1, 0.8, 0.5];
/** The outward curve where the island meets the top edge, and its bottom corners (styles.css). */
const FILLET = 8;
const RADIUS = 11;
/** Room either side of the words: the island's padding and the row's (styles.css). */
const PAD = 24;

/**
 * The island's outline without its top edge, from the left curve round to the right one, in a
 * box FILLET wider on each side: what the working light runs along.
 */
function outline(w: number, h: number) {
  const f = FILLET;
  const r = Math.min(RADIUS, h / 2, w / 2);
  return [
    `M 0 0.5`,
    `A ${f} ${f} 0 0 1 ${f} ${f}`,
    `L ${f} ${h - r}`,
    `A ${r} ${r} 0 0 0 ${f + r} ${h - 0.5}`,
    `L ${f + w - r} ${h - 0.5}`,
    `A ${r} ${r} 0 0 0 ${f + w} ${h - r}`,
    `L ${f + w} ${f}`,
    `A ${f} ${f} 0 0 1 ${2 * f + w} 0.5`,
  ].join(" ");
}
/** A menu bar this tall has a notch above it: the content sits below the notch. */
const NOTCHED = 30;
/** Wider than the notch on every MacBook that has one (about 200 points). */
const NOTCH_WIDTH = 220;

/**
 * Tandrix is active: an island hanging from the top edge of the screen (out of the notch, on Macs
 * that have one), its top corners curving out into the edge, saying what it's doing. It drops in,
 * changes width smoothly as what it says changes, and retracts when Tandrix is idle.
 * Click-through, so the screen stays free.
 */
export function PresenceBar({
  state,
  label,
  keys,
  keysHint,
  level = 0,
  top = 0,
  leaving = false,
}: PresenceBarProps) {
  const [width, setWidth] = useState<number>();
  // The island follows its content's width (measured again when the words or the font change), so
  // a change of words is a smooth stretch, not a jump.
  const observer = useRef<ResizeObserver | null>(null);
  const content = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    // Its layout width, not its drawn one: the island arrives scaled down.
    const measure = () => setWidth(el.offsetWidth);
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  const notched = top > NOTCHED;
  // The island's size as drawn, for the light that runs round its outline.
  const [box, setBox] = useState({ w: 0, h: 0 });
  const islandObserver = useRef<ResizeObserver | null>(null);
  const island = useCallback((el: HTMLDivElement | null) => {
    islandObserver.current?.disconnect();
    if (!el) return;
    const measure = () => setBox({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    islandObserver.current = new ResizeObserver(measure);
    islandObserver.current.observe(el);
  }, []);
  useEffect(() => () => islandObserver.current?.disconnect(), []);
  const ring = useId().replace(/:/g, "");
  const working = state === "thinking" || state === "looking" || state === "doing";
  return (
    <div
      className="tx-presence"
      data-state={state}
      data-leaving={leaving || undefined}
      role="status"
      aria-live="polite"
      style={{ ["--tx-level" as string]: Math.max(0, Math.min(1, level)) }}
    >
      <div
        className="tx-island"
        ref={island}
        style={{
          width: width ? Math.ceil(width) + PAD : undefined,
          // Out of the notch: as wide as it, at least, with the words below it.
          minWidth: notched ? NOTCH_WIDTH : undefined,
          paddingTop: notched ? top : 0,
        }}
      >
        <div className="tx-island-row">
          {/* Keyed by what it says, so new words fade in rather than snap. */}
          <div className="tx-island-content" ref={content} key={`${state}|${label}|${keys ?? ""}`}>
            {state === "listening" ? (
              <span className="tx-presence-meter" aria-hidden>
                {BARS.map((b, i) => (
                  <span key={i} style={{ ["--tx-bar" as string]: b }} />
                ))}
              </span>
            ) : state === "thinking" || state === "looking" ? (
              <span className="tx-presence-dots" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            ) : (
              <span className="tx-island-dot" aria-hidden />
            )}
            <span>{label}</span>
            {keys ? (
              <span className="tx-presence-keys">
                <kbd>{keys}</kbd>
                {keysHint ? <span>{keysHint}</span> : null}
              </span>
            ) : null}
          </div>
        </div>
        {box.w > 0 ? (
          <svg
            className="tx-island-edge"
            width={box.w + 2 * FILLET}
            height={box.h}
            viewBox={`0 0 ${box.w + 2 * FILLET} ${box.h}`}
            aria-hidden
          >
            {/* The ring of the earlier pill: Tandrix blue with a white highlight, round the whole
                outline; while it works the colours flow left to right, over and over. */}
            <defs>
              <linearGradient
                id={ring}
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={0}
                x2={box.w + 2 * FILLET}
                y2={0}
                spreadMethod="repeat"
              >
                <stop offset="0" stopColor="var(--highlight)" />
                <stop offset="0.18" stopColor="var(--highlight-halo)" />
                <stop offset="0.36" stopColor="var(--highlight)" />
                <stop offset="0.6" stopColor="var(--highlight)" stopOpacity={0.25} />
                <stop offset="1" stopColor="var(--highlight)" />
                {working ? (
                  <animateTransform
                    attributeName="gradientTransform"
                    type="translate"
                    from="0 0"
                    to={`${box.w + 2 * FILLET} 0`}
                    dur={state === "doing" ? "2.4s" : "1.6s"}
                    repeatCount="indefinite"
                  />
                ) : null}
              </linearGradient>
            </defs>
            <path
              d={outline(box.w, box.h)}
              className="tx-island-edge-glow"
              stroke={`url(#${ring})`}
            />
            <path
              d={outline(box.w, box.h)}
              className="tx-island-edge-line"
              stroke={`url(#${ring})`}
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
}

export interface ControlIndicatorProps {
  children?: ReactNode;
  stopLabel?: string;
  onStop?: () => void;
}

/** Shown top centre of the active display for as long as Tandrix is in Do it for me mode. */
export function ControlIndicator({
  children = "Tandrix is in control",
  stopLabel = "Stop (Esc)",
  onStop,
}: ControlIndicatorProps) {
  return (
    <div className="tx-ctl" role="status">
      <span className="tx-ctl-dot" aria-hidden />
      <span>{children}</span>
      <button type="button" onClick={onStop}>
        {stopLabel}
      </button>
    </div>
  );
}

export interface ConfirmDialogProps {
  title: string;
  lead?: string;
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmDialog({
  title,
  lead,
  note,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  // A modal: focus starts on the main action (autoFocus), and Esc is the same as Cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    // Over everything, centred, with the page dimmed behind; a click outside cancels.
    <div
      className="tx-dialog-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="tx-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="tx-dialog-body">
          <h2 className="tx-dialog-title" id={titleId}>
            {title}
          </h2>
          {lead ? <p className="tx-dialog-lead">{lead}</p> : null}
          {note ? <p className="tx-dialog-note">{note}</p> : null}
        </div>
        <div className="tx-dialog-foot">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button autoFocus variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Copy for the Show me → Do it for me confirmation. Product-owned; keep it calm and exact. */
export const doItForMeConfirmation = {
  title: "Let Tandrix click for you?",
  lead: "Clicking this allows Tandrix to control your device.",
  note: "Press Esc to take back control. Tandrix still asks before paying, sending, deleting or changing security settings.",
  confirmLabel: "Turn on",
  cancelLabel: "Keep pointing only",
} as const satisfies Omit<ConfirmDialogProps, "onConfirm" | "onCancel" | "tone">;

export interface ModeToggleProps {
  mode: ControlMode;
  /** Called with the requested mode. Open ConfirmDialog before applying "do". */
  onChange?: (mode: ControlMode) => void;
  label?: string;
}

export function ModeToggle({ mode, onChange, label = "How Tandrix helps" }: ModeToggleProps) {
  const option = (id: ControlMode, text: string, icon: "pointer" | "hand") => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === id}
      className={cx("tx-mode-opt", mode === id && "is-on")}
      onClick={() => {
        if (mode !== id) onChange?.(id);
      }}
    >
      <Icon name={icon} />
      {text}
      {id === "do" && mode === "do" ? <span className="tx-mode-dot" aria-hidden /> : null}
    </button>
  );
  return (
    <div className="tx-mode" role="radiogroup" aria-label={label}>
      {option("show", "Show me", "pointer")}
      {option("do", "Do it for me", "hand")}
    </div>
  );
}
