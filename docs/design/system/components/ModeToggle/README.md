# ModeToggle

ModeToggle switches the Mac app between **Show me** (Tandrix points, the user acts) and **Do it for me** (Tandrix clicks and types, guarded).

- A two-option segmented control in the Mac panel. Show me is the default and comes back at the start of each new job.
- Choosing Do it for me doesn't switch straight away: the consumer opens `ConfirmDialog` ("Clicking this allows Tandrix to control your device") and only sets `mode="do"` after Turn on.
- While Do it for me is on, the option shows a `highlight` dot, and `ControlIndicator` appears on screen.
- The voice commands "just do it" and "show me" request the same changes.
- **Provide:** `mode`, `onChange(requestedMode)`, optional `label`.
