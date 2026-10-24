# HandoffBanner

HandoffBanner moves one job between the phone and the Mac without losing its place.

- **offer** (phone): the next step is a screen step. One `field` primary action, "Continue on Mac", and the step it opens.
- **waiting** (phone): the step is open on the Mac. Says which device, and offers "Back to physical steps".
- **incoming** (Mac panel or notification): "Pump P-100 assembly: step 9 is ready", with "Open step 9".
- The same words name the same thing across devices: the job title, the step number, the device name the user gave it.
- **Provide:** `state`, `step`, `stepTitle`, `device`, `job`, `onAction`.
