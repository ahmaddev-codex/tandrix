// The pointing console's parts as server-built SVG, in painter's order: back to front, bottom to
// top. Moving parts are handed to the live component, which only moves them.
import { Dots, Line, Solid } from "../../iso/react/draw";
import {
  ARM_ART,
  BASE_ART,
  CARRIAGE_ART,
  GANTRY_ART,
  headArt,
  KEY_ART,
  KNOB_ART,
  PANEL_ART,
  ringFor,
  SCREEN_ART,
  SLIDER_ART,
  SWITCH_ART,
} from "./geometry";
import { REST, TARGETS } from "./view";

// Built hovering 10 over the first control; the plunger drops for the lower ones.
const HEAD = headArt(REST[2] + 10);

export const STATIC = (
  <g key="static">
    <path className="iso-halo" d={BASE_ART.halo} />
    {BASE_ART.feet.map(([pad, foot], i) => (
      <g key={i}>
        <Solid paths={pad!} tone="lo" />
        <Solid paths={foot!} tone="lo" />
      </g>
    ))}
    <Solid paths={BASE_ART.slab} tone="lo" />
    <Line d={BASE_ART.groove} tone="faint" />
    <Line d={BASE_ART.screwRings} tone="faint" />
    <Dots points={BASE_ART.screws} size={0.9} tone="mid" />
    <Solid paths={BASE_ART.label} tone="lo" />
    <Line d={BASE_ART.labelLine} tone="faint" />
    <Line d={BASE_ART.labelRule} tone="lo" free />
    <Dots points={BASE_ART.labelScrews} size={0.6} tone="mid" />
    <Line d={BASE_ART.ruler.minor} tone="faint" />
    <Line d={BASE_ART.ruler.major} tone="lo" />

    {GANTRY_ART.posts.map((post, i) => (
      <g key={i}>
        <Solid paths={post.foot} tone="lo" />
        <Dots points={post.screws} size={0.6} tone="mid" />
        <Solid paths={post.body} tone="mid" />
      </g>
    ))}

    <Solid paths={PANEL_ART.body} tone="mid" />
    <Line d={PANEL_ART.bezel} tone="faint" />
    <Line d={PANEL_ART.dividers} tone="faint" />
    <Dots points={PANEL_ART.screws} size={0.7} tone="mid" />

    {KNOB_ART.map((k, i) => (
      <g key={i}>
        <Line d={k.ticks.minor} tone="faint" />
        <Line d={k.ticks.major} tone="lo" />
        <Solid paths={k.collar} tone="lo" />
        <Solid paths={k.body} tone="hi" inner={<Line d={k.knurl} tone="faint" />} />
        <Line d={k.cap} tone="faint" />
        <Line d={k.mark} tone="hi" />
      </g>
    ))}
    {SWITCH_ART.map((s, i) => (
      <g key={i}>
        <Dots points={[s.led]} size={1.3} tone={s.on ? "hi" : "faint"} />
        <Solid paths={s.plate} tone="lo" />
        <Line d={s.slot} tone="faint" />
        <Solid paths={s.lever} tone="hi" />
      </g>
    ))}
    <Solid paths={SCREEN_ART.frame} tone="mid" />
    <Solid paths={SCREEN_ART.glass} tone="faint" flat />
    <Line d={SCREEN_ART.bars} tone="blue" />
    {KEY_ART.map((k, i) => (
      <g key={i}>
        <Line d={k.well} tone="faint" />
        <Solid paths={k.cap} tone="hi" />
        <Line d={k.dish} tone="faint" />
      </g>
    ))}
    <Solid paths={SLIDER_ART.track} tone="lo" />
    <Line d={SLIDER_ART.groove} tone="faint" />
    <Line d={SLIDER_ART.ticks.minor} tone="faint" />
    <Line d={SLIDER_ART.ticks.major} tone="lo" />
    <Solid paths={SLIDER_ART.thumb} tone="hi" />
    <Line d={SLIDER_ART.grip} tone="faint" />
  </g>
);

/** One ring per control, each exactly on its own control; the live part lights the one in use. */
export const RINGS = (
  <g key="rings">
    {TARGETS.map((t) => (
      <g key={t.id} data-ring={t.id} className="ptr-ring">
        <path className="iso-line" data-tone="blue" d={ringFor(t)} />
        <path className="iso-line ptr-glow" data-tone="blue" d={ringFor({ ...t, r: t.r + 4 })} />
      </g>
    ))}
  </g>
);

export const RAIL = (
  <g key="rail">
    <Solid paths={GANTRY_ART.rail} tone="mid" />
    <Line d={GANTRY_ART.railGroove} tone="faint" />
    <Line d={GANTRY_ART.railTicks.minor} tone="faint" />
    <Line d={GANTRY_ART.railTicks.major} tone="lo" />
  </g>
);

export const CARRIAGE = (
  <g key="carriage">
    <Solid paths={CARRIAGE_ART.hanger} tone="mid" />
    <Solid paths={CARRIAGE_ART.block} tone="hi" />
    <Dots points={CARRIAGE_ART.screws} size={0.6} tone="mid" />
  </g>
);

export const PLUNGER = (
  <g key="plunger">
    <Solid paths={HEAD.tip} tone="hi" lit />
    <Solid paths={HEAD.stylus} tone="hi" />
  </g>
);

export const HOUSING = (
  <g key="housing">
    <Solid paths={HEAD.housing} tone="hi" inner={<Line d={HEAD.knurl} tone="faint" />} />
    <Solid paths={HEAD.collar} tone="mid" />
    <Line d={HEAD.lamp} tone="blue" />
  </g>
);

export const ARM = (
  <g key="arm">
    <Solid paths={ARM_ART.endCap} tone="mid" />
    <Solid paths={ARM_ART.arm} tone="mid" />
    <Line d={ARM_ART.groove} tone="faint" />
    <Line d={ARM_ART.ticks.minor} tone="faint" />
    <Line d={ARM_ART.ticks.major} tone="lo" />
  </g>
);

export const HEAD_HIGH = (
  <g key="head-high">
    <Solid paths={HEAD.sled} tone="hi" />
    <Dots points={HEAD.sledScrews} size={0.6} tone="mid" />
  </g>
);
