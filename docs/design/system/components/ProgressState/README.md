# ProgressState

ProgressState fills a screen while Tandrix does something that takes a while, such as reading a whole manual, and explains what to do if it stops.

- **Busy:** a small spinner and one line in `field-body` `text-secondary` that says what is happening now. Change the line as time passes ("Reading the manual", "Writing the steps", "Still writing. Long manuals can take a couple of minutes."). No percentages Tandrix can't know.
- **Failed:** a neutral `Notice` with the reason, a `field` primary "Try again" and, if useful, a `secondary` way back.
- The spinner is the one thing that moves; under reduced motion it slows right down.
- **Provide:** `label`; when it stops, `failed`, `onRetry`, optional `retryLabel`, `backLabel`, `onBack`.
- **Don't:** use it for waits under a second, or blame the user for a service failure.
