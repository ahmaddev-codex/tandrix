// The desk, framed on the whole desk (A day with Tandrix) or on a few objects (the Ask cards).
// Drawn straight on the page in the site's theme.
import { fitProjection } from "@/vendor/anatomy/iso-kit";
import { DeskArt, type Focus } from "./art";
import { AZIMUTH, BOUNDS, DESK_BOUNDS, type DeskObject } from "./layout";

export function DeskFigure({
  focus,
  only,
  label,
  width = 640,
  height = 440,
}: {
  focus: Focus;
  only?: DeskObject[];
  label: string;
  width?: number;
  height?: number;
}) {
  const points = only
    ? only.flatMap((o) => BOUNDS[o])
    : DESK_BOUNDS.concat(BOUNDS.laptop, BOUNDS.router);
  const P = fitProjection(points, width, height, { pad: only ? 18 : 12, azimuth: AZIMUTH });
  return (
    <div className="iso flex size-full min-h-0 justify-center [--anatomy-card:var(--fig-ground,var(--background-100))] [--anatomy-paper:var(--fig-ground,var(--background-100))] [&_.iso-svg]:h-full [&_.iso-svg]:w-auto [&_.iso-svg]:max-w-full">
      <svg className="iso-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <DeskArt P={P} focus={focus} only={only} />
      </svg>
    </div>
  );
}
