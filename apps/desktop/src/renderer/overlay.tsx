import "@tandrix/ui/tokens.css";
import "@tandrix/ui/web/styles.css";
import "./fonts.css";
import "./overlay.css";
import { PointerBuddy, PresenceBar } from "@tandrix/ui/web";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { OverlayPointer, OverlayPresence } from "../shared/bridge";
import { WorkPointer } from "./WorkPointer";

/** How long the island takes to retract into the top edge (styles.css tx-island-out). */
const LEAVE_MS = 260;

function Overlay() {
  const [pointer, setPointer] = useState<OverlayPointer | null>(null);
  // The presence shown, and whether it's on its way out: it retracts before it's gone.
  const [presence, setPresence] = useState<OverlayPresence | null>(null);
  const [leaving, setLeaving] = useState(false);
  const gone = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A mark replaced or cleared fades out rather than vanishing (a tour of parts, one by one).
  const [leavingPointer, setLeavingPointer] = useState<OverlayPointer | null>(null);
  const current = useRef<OverlayPointer | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () =>
      window.tandrix.overlay.onPointer((p) => {
        const before = current.current;
        current.current = p;
        if (before && !before.working && (!p || p.x !== before.x || p.y !== before.y)) {
          clearTimeout(leaveTimer.current);
          setLeavingPointer(before);
          leaveTimer.current = setTimeout(() => setLeavingPointer(null), 420);
        }
        setPointer(p);
      }),
    [],
  );
  useEffect(
    () =>
      window.tandrix.overlay.onPresence((p) => {
        clearTimeout(gone.current);
        if (p) {
          setLeaving(false);
          setPresence(p);
          return;
        }
        setLeaving(true);
        gone.current = setTimeout(() => {
          setPresence(null);
          setLeaving(false);
        }, LEAVE_MS);
      }),
    [],
  );
  return (
    <>
      {presence ? <PresenceBar {...presence} leaving={leaving} /> : null}
      {/* The mark being replaced fades out under the new one. */}
      {leavingPointer ? (
        <div className="tx-leaving" key={`out-${leavingPointer.x},${leavingPointer.y}`}>
          <PointerBuddy
            x={leavingPointer.x}
            y={leavingPointer.y}
            box={leavingPointer.box}
            label={leavingPointer.label}
            note={leavingPointer.note}
            hold={leavingPointer.hold}
            regions={leavingPointer.regions}
          />
        </div>
      ) : null}
      {pointer?.working ? (
        <WorkPointer p={pointer} />
      ) : pointer ? (
        <PointerBuddy
          // A new annotation draws itself afresh.
          key={`${pointer.x},${pointer.y},${pointer.box?.width ?? 0}`}
          x={pointer.x}
          y={pointer.y}
          box={pointer.box}
          step={pointer.step}
          label={pointer.label}
          note={pointer.note}
          hold={pointer.hold}
          regions={pointer.regions}
        />
      ) : null}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Overlay />
  </StrictMode>,
);
