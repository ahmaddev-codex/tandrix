# StatusChip

A StatusChip shows where a step stands and how that is known. Each status always has an icon and a word, never colour alone.

| Status | Meaning | Look |
|---|---|---|
| `verified` | A recorded check (photo or screen) passed. Only this status may say "Verified". | `green-900` on `green-100` |
| `confirmed` | The user said it's done; no evidence. | `text` on `gray-100`, with a hairline |
| `attention` | A check found something wrong. | `amber-900` on `amber-100` |
| `unverifiable` | A photo can't show it (torque, internal fit). | `text-secondary`, with a `border-control` outline |
| `blocked` | Waiting on something, such as a missing part or a safety gate. | `red-900` on `red-100` |
| `pending` | Captured offline and not yet checked. | `text-secondary` on `gray-100` |
| `progress` | The step is in progress. | `blue-900` on `blue-100` |

- **Provide:** `status`. Change the label with children only if the meaning stays the same ("Missing part 7" for blocked).
- **Don't:** show `confirmed` with green or a check mark.
