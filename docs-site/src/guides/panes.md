---
title: Panes
lead: Monaco editors over one document. Mount them anywhere; editing any of them updates the others.
---

| Pane | Function | Element `type` | Edits flow back | Scroll linked |
|---|---|---|---|---|
| bitmark | `createBitmarkPane` | `bitmark` | it *is* the document | yes |
| JSON | `createJsonPane` (`mode: 'optimized' \| 'full'`) | `json` (`mode`) | yes | yes |
| HTML | `createHtmlPane` | `html` | yes | yes |
| XML | `createXmlPane` (`mapping`) | `xml` (`mapping`) | yes | yes |
| Text | `createTextPane` | `text` | read-only | yes |
| Info | `createInfoPane` | `info` | read-only | no |
| Mappings | `createMappingsPane` | `mappings` | read-only | no |

{% highlight "ts" %}
const json = createJsonPane(element, session, { mode: 'full', readOnly: true });
{% endhighlight %}

The HTML, XML, Text, Info and Mappings panes need the parser's `full`
variant. While only `bitmark-json` is loaded, they say so ([The parser](/guides/parser/)).

## Options

| Option | |
|---|---|
| `readOnly` | Read-only. At runtime: `pane.setReadOnly()` |
| `scrollSync` | Take part in the session's scroll linking (default `true` where the table says so). At runtime: `pane.setScrollSync()` |
| `label` | The pane's label |
| `editorOptions` | Passed to Monaco's editor |
| `errorSlot` | An element, or a callback, that receives the pane's error message |
| `onRender` | Called with `{ durationMs }` after each conversion the pane shows |

## Scroll linking

Linked panes keep the same bit in view, whichever one you scroll. It works by
bit, so it lines up bitmark with JSON, HTML or XML, and in a pane you typed or
pasted into too: the conversion reports where each bit starts in your text
(parser 7.8 and later).

- `session.setScrollSync([bitmark, html])` links exactly those panes.
- `scrollGroup` (a session option) joins an existing group, so that editors of
  your own scroll with the session's panes. Create one with
  `createScrollSyncGroup()`.

## Errors

On an error, the pane you edited keeps your text, shows the error and gets a
marker. The other panes keep their last good content and are marked stale. A
pane's content is never replaced by an error.

## Edits and undo

- Each pane keeps its own undo history. Regenerating a pane is one undoable
  edit, not a reset.
- A pane that has focus is never overwritten while you work in it.
- A programmatic change (`setBitmark`) never comes back to you as an edit.
