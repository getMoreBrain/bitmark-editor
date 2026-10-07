# A note for the parser repo (PLAN-022 D16)

Optional, not blocking. Of the three asks in the plan, two are already met
by `@gmb/bitmark-parser` 7.7.0+: its published types carry the editor
services (`Diagnostics`, `CompletionList`, `Hover`, `Position`), and
`OutputFormat` accepts mapping ids.

One remains, and there is one new ask:

- **Export the active variant**, e.g. `activeFeature(): Feature | undefined`.
  `init` can be called again and swaps the variant atomically, and nothing
  reports which one is active. So when a host injects its own parser
  module, `@gmb/bitmark-editor` has to be told the variant
  (`{ module, feature }`, and `engine.setFeature()` after each host
  `init`), rather than reading it. With the export, the editor could
  detect it, and a wrong declaration could no longer leave a pane saying
  "needs the full parser" on a full engine.
- **Export `UnsupportedFeatureError`** (at least its type). The doc comments
  of `complete`, `resolve` and `hover` link to it, but it isn't exported, so
  the link is broken in the parser's own types, and in the editor's API
  reference, which reuses them (3 of the editor's 9 typedoc warnings,
  PLAN-025).
