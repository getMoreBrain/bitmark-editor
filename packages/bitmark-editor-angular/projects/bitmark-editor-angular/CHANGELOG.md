# Changelog

## 0.1.0 (2026-10-07)

- `bm-pane` takes `editorOptions`, passed to Monaco, as the core's panes and
  React's `<BitmarkPane>` do.
- `applyMonacoTheme`, in `provideBitmarkEditor` and as a `bm-session` input:
  the session sets Monaco's theme from `theme` too.
- First release: `bm-session` (with `ControlValueAccessor`), `bm-pane`,
  `bm-tabs`, `bm-split` and `provideBitmarkEditor`.
