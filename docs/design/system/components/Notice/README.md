# Notice

A Notice tells the user something about the screen they're on, in one or two plain sentences, with an icon and a tone.

- **neutral** (default): `text` on `gray-100`. Use it when a service can't help right now and the screen still works: "Tandrix can't search for the manual right now. Upload it, or photograph the pages."
- **info:** `blue-900` on `blue-100`. A read that needs your eye: "Read from the nameplate. Check the details, then save."
- **attention:** `amber-900` on `amber-100`. Something is uncertain or needs fixing: "Possible match. Check these against the nameplate."
- **error:** `red-900` on `red-100`. Something failed and the user must act.
- There is no success tone: green means only `verified`, and a Notice never verifies anything.
- Say what happened and what to do next, in the interface's voice. No apology, no "Oops".
- **Provide:** `children` (the message), `tone`, optional `title`, `icon` and one `action` Button.
- **Don't:** stack several Notices, or use one where a `StatusChip` or `CheckResult` says it better.
