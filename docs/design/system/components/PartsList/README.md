# PartsList

PartsList shows the parts check: the parts list from the manual matched against one photo of the laid-out parts.

- **Summary:** first a count ("11 of 12 parts found"), then what needs action ("1 missing, 1 to confirm").
- **Rows:** part number in mono, name with an optional note, quantity in mono, then a status: Found (green), Possible match (amber), Missing (red). Each status carries its icon and word.
- Rows are `control-field` tall and tappable: tapping opens the correction sheet and highlights that part on the photo.
- Missing parts block the steps that need them (see StatusChip `blocked`).
- **Provide:** `parts` with `part`, `name`, `qty`, `status`, optional `note`; `onSelect`.
