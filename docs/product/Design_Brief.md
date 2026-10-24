# Tandrix — Design Brief

Visual language, tokens, components and copy rules live in the **Tandrix design system**: https://claude.ai/artifact/JXT7ErJARYzNkiv8EQjpvp (mirrored in [docs/design/system](../design/system/README.md); decision in [docs/design/decision.md](../design/decision.md)). This brief only states the product requirements the system must meet.

## Objective

Tandrix should feel like a calm senior engineer standing next to you: it looks first, points precisely, speaks briefly, and says when it isn't sure. It has to work in bright sunlight with gloves on as well as at a desk.

## Requirements by surface

| Surface | Must |
|---|---|
| Phone (site) | Readable in direct sun; primary actions usable with gloves; the camera frame dominant; one instruction, one action, one check per step. |
| Glasses | Voice carries the instruction; lens shows one step, two lines at most. |
| Mac overlay | Pointer and caption readable over any app; clearly distinct from the user's cursor; visible indicator whenever Tandrix is in control. |
| Mac panel and web report | Dense but calm; evidence and sources scannable. |

## Product rules the design must express

1. **Show, then tell.** Highlight the part or control first, then the instruction.
2. **Progress never lies.** Verified by evidence looks different from user-confirmed.
3. **Sources visible.** Every step shows where it came from; generic steps are marked.
4. **Safety in place.** Cautions sit on the step they apply to; safety gates need a deliberate confirm.
5. **Uncertainty is designed.** "Possible match", "Can't check from a photo" and "Not verified" are first-class states.
6. **Hands-free first.** Every primary action has a voice command.
7. **Calm control.** Switching to Do it for me is plain and reassuring, not alarming: "Clicking this allows Tandrix to control your device."

## Accessibility

WCAG 2.2 AA everywhere; a high-contrast Sunlight theme at 7:1; status never by colour alone; text alternatives for every highlight; captions for all speech; reduced-motion respected.

## Assets needed

- Logo (none yet; the name is set in type until then).
- Real photos of the demo pump, its parts and nameplate, taken by the team.
- Demo video from real app captures; concept art labelled as concept.
