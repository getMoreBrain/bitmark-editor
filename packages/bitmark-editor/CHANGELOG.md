# Changelog

## 0.1.0 (unreleased)

- `<bitmark-pane>` takes Monaco options in its `editorOptions` property, as
  `<BitmarkPane>` and `bm-pane` do, and `<bitmark-editor>` hands them to the
  panes it builds through `paneEditorOptions`, by pane type.
- `/bundled`: Monaco's editor features are registered before Monaco starts.
  Before, they loaded with the JSON language, after Monaco had taken its
  services, so an editor created later (a tab, a pane added at runtime)
  threw "depends on UNKNOWN service ICodeLensCache" once the page was idle.
- A session without a `theme` warns once per page when Monaco's theme is the
  host's (the dark token palette would meet a light Monaco). With
  `applyMonacoTheme`, Monaco gets the panes' default (dark) theme.
- `<BitmarkPane>` (React) sizes its `<div>` with `box-sizing: border-box`, so a
  host border or padding can't make a content-sized grid or flex parent grow.
- First release: the async engine (main thread or worker), the Monaco
  services on an injected Monaco, the session and its panes (bitmark, JSON,
  HTML, XML, Text, Info, Mappings), the N-way scroll group, and the themes.
