# Icon

Icons are Phosphor glyphs in two styles: solid (Phosphor Fill) for small inline icons and outline (Phosphor Regular) for standalone icons.

- **Sizes and style:** 16px solid inside chips, inputs and small buttons; 20px outline in cards, banners, notices and `lg` buttons; 24px outline in `field` buttons. `Icon` picks the style from `size`.
- **Weight:** set `weight` ("fill" or "outline") only to break the rule on purpose, such as a selected item shown solid.
- **Check and progress:** always outline, at every size.
- They take `currentColor`, so they inherit the text colour they sit with.
- Decorative icons are hidden from assistive tech. Give an icon `label` only when it stands alone.
- For any glyph not in this bundle, use the same Phosphor icon in the same style (`@phosphor-icons/react` on the Mac and web, `phosphor-react-native` on the phone). Never another icon set.
