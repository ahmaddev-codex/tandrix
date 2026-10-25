# VoiceTranscript

VoiceTranscript shows what Tandrix heard and what it said back, under the `StepCard`. Replies are spoken too, but a site is loud, so the words stay on screen.

- **Turns:** a `label-12` speaker ("You", "Tandrix") over the words in `copy-14`. The last four turns show; older ones scroll away.
- **Refusal:** when Tandrix won't guide something (wiring, live work), the reply is `red-900` with the stop icon, the same reason the stop `SafetyGate` gives.
- **General advice:** a reply that doesn't come from the step or its manual carries the Generic `SourceChip`, so it's never mistaken for the manufacturer's word.
- **States:** while the mic is held, a `red-700` dot (it pulses; still under reduced motion) and "Listening. Let go to send."; then a spinner and "Working it out".
- **Look:** `background-100`, `shadow-sm`, padding `space-4`, `radius-lg`. Hidden when there is nothing to show.
- **Provide:** `state` and `turns`. Pair it with the icon-only mic `Button` in the StepCard ("Hold to talk").
- **Don't:** use it for chat away from a step, or show a reply without speaking it.
