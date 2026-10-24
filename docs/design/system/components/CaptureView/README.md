# CaptureView

CaptureView is the phone's camera surface: the live view, the captured photo, and the wait while Tandrix analyses it.

- **States:** `live` (shutter centred, mic at the side, optional hint), `preview` (Retake and Use photo at `field` size), `analyzing` (dimmed with `overlay-scrim` and a spinner, saying what Tandrix is looking for, such as "Finding the impeller").
- **Indicator:** a "Camera on" or "Glasses camera on" pill with a red dot, visible whenever the camera or glasses stream is live. When `onSwitchSource` is given, a switch moves between phone and glasses.
- **Hint:** at most one line, telling the user how to frame the shot ("Show the open housing from the front"). Use it for retake guidance too.
- **Chrome over the frame** uses overlay tokens so it reads on any photo.
- **Provide:** the frame (camera view or photo) as children, `state`, `source`, and the handlers `onCapture`, `onRetake`, `onUse`, `onTalk`, `onSwitchSource`.
- **Don't:** capture without a user action, or hide the camera-on indicator.
