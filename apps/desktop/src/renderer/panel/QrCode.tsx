import { encode } from "uqr";
import { useMemo } from "react";

/** A QR code drawn as SVG squares, always dark on light so phone cameras read it in any theme. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const qr = useMemo(() => encode(value, { ecc: "M", border: 2 }), [value]);
  const path = useMemo(
    () =>
      qr.data.flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : ""))).join(""),
    [qr],
  );
  return (
    <div className="pair-qr" data-theme="light">
      <svg
        viewBox={`0 0 ${qr.size} ${qr.size}`}
        role="img"
        aria-label={label}
        shapeRendering="crispEdges"
      >
        <path d={path} />
      </svg>
    </div>
  );
}
