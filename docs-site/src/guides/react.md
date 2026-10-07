---
title: React
lead: A session in context, and panes as components. React 18 and 19.
---

{% highlight "tsx" %}{% raw %}import { BitmarkPane, BitmarkSession } from '@gmb/bitmark-editor/react';

<BitmarkSession monaco={monaco} theme="light" value={doc} onChange={(e) => setDoc(e.bitmark)}>
  <BitmarkPane type="bitmark" style={{ height: 300 }} />
  <BitmarkPane type="json" readOnly style={{ height: 300 }} />
</BitmarkSession>
{% endraw %}{% endhighlight %}

`monaco` is your app's Monaco, set up as in
[A host with Monaco](/guides/host-with-monaco/) (its workers, its theme). The
[React example app](/demos/example-apps/) is this setup, complete.

## `<BitmarkSession>`

It creates one session when it mounts, and passes it to the panes inside it.
`monaco` and `engine` are read then; later changes to them have no effect.

| Prop | |
|---|---|
| `monaco` | Your Monaco. Required. |
| `value` | The document. A new value from outside replaces it. |
| `theme`, `applyMonacoTheme` | See [Theming](/guides/theming/). |
| `engine`, `debounceMs`, `schema`, `messages`, `scrollGroup` | As for [the session](/guides/session/). |
| `onChange`, `onError`, `onReady` | The session's events. |

**Feeding your state back as `value` is safe.** A `value` that is your own
state lagging behind (one of the last few documents the session reported) is
recognised as an echo and ignored, so it never undoes the user's typing. To
set the document back to such a value on purpose, call `session.setBitmark()`
on the session from `useBitmarkSession()`.

## `<BitmarkPane>`

| Prop | |
|---|---|
| `type` | `bitmark`, `json`, `html`, `xml`, `text`, `info` or `mappings` |
| `mode` | JSON: `optimized` (default) or `full` |
| `mapping` | XML: the mapping id (default `xml-niso-iec`) |
| `readOnly`, `scrollSync`, `label`, `editorOptions` | As for [panes](/guides/panes/) |
| `className`, `style` | On the pane's `<div>` |
| `onPane`, `onRender` | The pane, once mounted; the time each regeneration took |

The pane fills a `<div>` that you size. That `<div>` has `height: 100%` and
`box-sizing: border-box`, so a border or padding from your `className` stays
inside the height.

## `useBitmarkSession()`

The nearest `<BitmarkSession>`'s session, for its methods: `setBitmark`,
`setTheme`, `getJson` and the rest ([the session](/guides/session/)).
`undefined` until it exists.
