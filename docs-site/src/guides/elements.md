---
title: Custom elements
lead: The editor as HTML elements, for any page or framework. From /bundled (with Monaco) or /elements (with yours).
---

{% highlight "html" %}
<bitmark-session theme="auto" value="[.article]&#10;Hello">
  <bitmark-split>
    <bitmark-pane type="bitmark"></bitmark-pane>
    <bitmark-tabs>
      <bitmark-pane type="json" label="JSON"></bitmark-pane>
      <bitmark-pane type="html" label="HTML"></bitmark-pane>
    </bitmark-tabs>
  </bitmark-split>
</bitmark-session>
{% endhighlight %}

## `<bitmark-session>`

One document. Its panes are the `<bitmark-pane>` elements inside it.

| Attribute | |
|---|---|
| `value` | The initial document |
| `theme` | `dark` (default), `light` or `auto` |
| `apply-monaco-theme` | Set Monaco's theme too. `/bundled` does it without this, since its Monaco is its own |
| `lazy` | `idle`, `click`, `focus`, `visible`, or none ([Static site](/guides/static-site/)) |
| `narrow` | `static`, `readonly` or `edit` |
| `debounce` | Wait this many milliseconds for a pause in typing before converting |
| `schema` | The JSON schema's URL, or `off` |
| `engine-url`, `engine-version`, `engine-feature` | How to load the parser ([The parser](/guides/parser/)) |

| Property | |
|---|---|
| `monaco` | Your Monaco (with `/elements`). Set it before the session starts |
| `engine` | An injected parser module (`{ module, feature }`) |
| `messages` | The UI strings, for example from your site's i18n. Read when the session starts |
| `value` | The document; setting it replaces the document |
| `session` | The [session](/guides/session/), once started |
| `getJson()` | The document as JSON (a promise) |
| `start()` | Start a lazy session now |

Events: `change`, `ready`, `error`, with the session's details in `event.detail`.

A `value` attribute that lags behind your own edits is recognised as an echo
and ignored, as in [React](/guides/react/).

## `<bitmark-pane>`

| Attribute | |
|---|---|
| `type` | `bitmark`, `json`, `html`, `xml`, `text`, `info` or `mappings` |
| `mode` | JSON: `optimized` or `full` |
| `mapping` | XML: the mapping id |
| `label` | The pane's label (in tabs, its tab) |
| `readonly` | Read-only |
| `scroll-sync="off"` | Leave the session's scroll linking |
| `session="<id>"` | The session, when the pane isn't inside it |

## Layout elements

- `<bitmark-tabs>`: tabs over its child panes; only the active one is mounted.
- `<bitmark-split direction="row|column|auto">`: panes side by side or stacked.
- `<bitmark-editor panes="json,html,xml:xml-niso-iec">`: the full editor in one
  tag, the bitmark pane beside tabs over the panes you list. The
  [Try it demo](/demos/try-it/) uses it.

## Server-side rendering

Importing `/elements` or `/bundled` during server-side rendering is harmless:
the elements are defined only in a browser.
