# Design direction decision

**Date:** 24 Oct 2026
**Decision:** Tandrix uses a design system in the manner of Vercel's Geist: monochrome-first, high contrast, Geist Sans and Geist Mono (SIL Open Font License), a strict gray scale with a small set of semantic colour scales, hairline borders, restrained radius and almost no decoration.

Candidates considered: Callout, Signal, Viewfinder (https://claude.ai/artifact/A1XC5MQ8tY7sRGhg4ojgXd). None was chosen; the Geist manner was preferred.

## Why it fits
- Black-on-white and white-on-black give the strongest contrast for sunlight and for the glasses lens (additive display: black is see-through).
- Quiet, precise visual language matches "evidence before confidence".
- One system scales from dense Mac panels and reports to large phone controls.

## Tandrix extensions (not in Geist; owned by Tandrix)
- **Field sizes:** an extra-large control size for phone and gloves.
- **Highlight:** spec for marking parts on camera frames, readable on any image.
- **Pointer:** spec for the Mac overlay pointer, caption and in-control indicator, readable over any app.
- **Evidence statuses:** verified, you confirmed, needs attention, can't check from a photo, generic.
- **Safety tier:** stop, warning and mandatory-action semantics aligned with ISO 7010 meanings.
- **Glasses lens:** rules for the Ray-Ban Display.

## Boundaries
- Tandrix's own tokens and components; no Vercel logos, marks, names or product imagery.
- Geist fonts used under their open licence.
