# ConfirmDialog

ConfirmDialog asks before a mode change or consequential action. Its first use is switching from Show me to Do it for me.

- **Tone:** calm and plain, never alarming. The lead line is the exact consequence: "Clicking this allows Tandrix to control your device."
- **Anatomy:** title as a question, `lead` (`text`, medium weight), `note` in `text-secondary` saying how to take back control, and a footer on `background-200` with Cancel (secondary) and Confirm (primary).
- The buttons say what happens ("Turn on", "Keep pointing only"), never "OK" or "Yes".
- Set `tone="danger"` only for destructive confirmations ("Delete job").
- **Provide:** `title`, `lead`, `note`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`.
