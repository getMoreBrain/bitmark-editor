---
title: The session
lead: One bitmark document, the source of truth for its panes.
---

{% highlight "ts" %}
const session = createBitmarkSession({ monaco, value, theme: 'light' });
session.on('change', ({ bitmark, source }) => save(bitmark));
{% endhighlight %}

## Options

`createBitmarkSession({ monaco, engine?, value?, debounceMs?, theme?, applyMonacoTheme?, schema?, messages?, scrollGroup? })`

| Option | |
|---|---|
| `monaco` | Your Monaco. Required |
| `engine` | The parser: loaded (default) or injected. See [The parser](/guides/parser/) |
| `value` | The initial document |
| `debounceMs` | Wait for a pause in typing before converting. Default 0: every edit converts. The last edit wins |
| `theme` | `'dark'` (default), `'light'`, `'auto'` (follows the OS), or a custom theme. See [Theming](/guides/theming/) |
| `applyMonacoTheme` | Set Monaco's (page-wide) theme from `theme` too. Default `false` |
| `schema` | The JSON schema: an object, its URL, or `false`. The default comes from beside the parser, or from the CDN at the parser's version. It applies only to the session's own JSON models, never to your other JSON editors |
| `messages` | Every UI string, the pane labels included |
| `scrollGroup` | An existing scroll group to join ([Panes](/guides/panes/#scroll-linking)) |

## Methods

| | |
|---|---|
| `getBitmark()` | The document |
| `setBitmark(text, origin?)` | Set the document from your code. `origin` (`{ inputFormat, content, label }`) names the edit for the Mappings pane; `false` means it isn't an edit (a document switch) |
| `getJson({ mode? })` | The document as JSON (a promise) |
| `panes()` | Its panes |
| `setScrollSync(panes)` | Link exactly these panes |
| `setTheme(theme)` | Change the theme |
| `engine`, `ready` | The engine once loaded, and a promise of it |
| `dispose()` | Remove its panes and stop |

## Events

`session.on(event, handler)` returns a function that removes the handler.

| Event | Details |
|---|---|
| `change` | `{ bitmark, source }`: the new document, and the pane it came from (`undefined` for `setBitmark`) |
| `error` | `{ error, pane }`: a conversion or the engine failed |
| `ready` | The engine: the parser has loaded |

The custom elements dispatch the same events as DOM events, with these
details in `event.detail`.
