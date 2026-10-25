# JobReport

JobReport is the honest record of a job: what was verified, what the user confirmed, and what is still open. It's used in the app and on the shared web link.

- **Header:** job title in `heading-24`; a meta line naming the asset, serial, site, date, time span and devices used.
- **Counts:** Verified, You confirmed, Needs attention, Unresolved. Each count sits beside its StatusChip. These four numbers are the point of the report, so they lead.
- **Timeline:** one row per step with number, evidence thumbnail, title, StatusChip, SourceChip and time. Steps without photo evidence show a document glyph, not an empty box.
- **Footnote:** always states what verified means and that the report doesn't certify the installation.
- **Provide:** `title`, `meta`, `counts`, `steps` (`index`, `title`, `status`, `source`, `sourceKind`, `time`, `thumbnail`), `footnote`.
