# Icon

Icons are Phosphor glyphs and nothing else, on every surface, in two styles: solid (Phosphor Fill) for small inline icons and outline (Phosphor Regular) for standalone icons.

- **Sizes and style:** 16px solid inside chips, inputs and small buttons; 20px outline in cards, banners, notices and `lg` buttons; 24px outline in `field` buttons. `Icon` picks the style from `size`.
- **Always outline, at every size:** block (`stop`), caution (`alert`), and the line-shaped icons (`check`, `progress`, `retake`, `x`, `plus`, `menu`, `expand`, `actions`, `chevronLeft`, `chevronRight`, `chevronDown`, `arrowRight`, `arrowUpRight`).
- **Weight:** set `weight="fill"` only on purpose: a selected state, a verified or done mark (`sealCheck`), play, and feature icons on marketing cards.
- They take `currentColor`, so they inherit the text colour they sit with.
- Decorative icons are hidden from assistive tech. Give an icon `label` only when it stands alone.
- Use them judiciously: one where it helps someone scan or recognise a thing, none as decoration.
- To add a glyph, add its Phosphor name to `packages/ui/scripts/build-icons.ts` and run `pnpm --filter @tandrix/ui build:icons`. Never another icon set, a hand-drawn icon, or a text glyph such as an arrow.
