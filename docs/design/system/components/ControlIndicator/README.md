# ControlIndicator

ControlIndicator stays on screen, top centre of the active display, for as long as Tandrix is in Do it for me mode.

- `overlay-ground` pill with a pulsing `highlight` dot, "Tandrix is in control", and a Stop button that also names the shortcut ("Stop (Esc)").
- The same in every theme, because it sits over other apps.
- Esc, the hotkey, or moving the mouse or typing stops Tandrix as well as the button.
- **Provide:** `onStop`. Change the label only for other control states ("Tandrix is paused").
- **Don't:** hide it, auto-dismiss it, or style it as an alarm.
