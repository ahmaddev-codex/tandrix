import "@tandrix/ui/tokens.css";
import "@tandrix/ui/web/styles.css";
import "./fonts.css";
import "./overlay.css";
import { PointerBuddy } from "@tandrix/ui/web";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { OverlayPointer } from "../shared/bridge";

function Overlay() {
  const [pointer, setPointer] = useState<OverlayPointer | null>(null);
  useEffect(() => window.tandrix.overlay.onPointer(setPointer), []);
  return pointer ? <PointerBuddy x={pointer.x} y={pointer.y} caption={pointer.caption} /> : null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Overlay />
  </StrictMode>,
);
