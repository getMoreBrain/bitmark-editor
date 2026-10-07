---
title: Angular
lead: "@gmb/bitmark-editor-angular: bm-session (a form control), bm-pane, bm-tabs and bm-split. Angular 21 and 22."
---

{% highlight "sh" %}
npm install @gmb/bitmark-editor @gmb/bitmark-editor-angular monaco-editor
{% endhighlight %}

Give every session its defaults once, in the app's providers:

{% highlight "ts" %}
import { provideBitmarkEditor } from '@gmb/bitmark-editor-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBitmarkEditor({
      // Your Monaco, loaded on first use: a value or an async factory.
      monaco: () => import('./monaco').then((m) => m.loadMonaco()),
      // The app owns its Monaco: sessions set its theme to match.
      applyMonacoTheme: true,
    }),
  ],
};
{% endhighlight %}

Then use the components:

{% highlight "html" %}
<bm-session [formControl]="content" [theme]="theme()" (change)="onChange($event)" style="height: 320px">
  <bm-split>
    <bm-pane type="bitmark" />
    <bm-tabs>
      <bm-pane type="json" />
      <bm-pane type="html" />
    </bm-tabs>
  </bm-split>
</bm-session>
{% endhighlight %}

The [Angular example app](/demos/example-apps/) is a complete zoneless app
with this setup, including Monaco's workers and styles for Angular's builder.

## `provideBitmarkEditor`

| Option | |
|---|---|
| `monaco` | Your Monaco, or an async factory (for example waiting for `window.monaco`, or a dynamic import) |
| `engine` | The parser: injected, or how to load it ([The parser](/guides/parser/)). A factory is called once per session |
| `theme`, `applyMonacoTheme` | The defaults for every session ([Theming](/guides/theming/)) |
| `messages`, `schema` | As for [the session](/guides/session/) |
| `fixedOverflowWidgets` | Default `true`: Monaco's widgets go to one fixed overflow node, so scroll containers and dialogs don't clip them |

## `bm-session`

- Inputs: `value`, `monaco`, `engine`, `theme`, `applyMonacoTheme`,
  `debounceMs`, `schema`. They override the provider's defaults.
- Outputs: `change`, `ready`, `error`.
- As a **form control** (`formControl`, `formControlName`, `ngModel`), its
  value is the bitmark text. Disabling the control makes the panes read-only.
- A `[value]` that is your own state lagging behind is recognised as an echo
  and ignored, as in [React](/guides/react/).

## `bm-pane`, `bm-tabs`, `bm-split`

- `bm-pane` inputs: `type` (`bitmark`, `json`, `html`, `xml`, `text`, `info`,
  `mappings`), `mode`, `mapping`, `label`, `readonly`, `scrollSync`,
  `inactive`. It fills its box, so size the outermost one.
- `bm-tabs`: tabs over its panes (`[(active)]`, `tabLabels`); only the active
  pane is mounted.
- `bm-split`: panes side by side (`direction`: `row` or `column`).

## Zones

Monaco and the session run outside the Angular zone, and the outputs re-enter
it. So in an app with zone change detection, change detection runs once per
document change, not once per Monaco event. In a zoneless app the same code
costs nothing.

## Two setups, both tested

- **The example app** in `examples/angular`: zoneless, standalone components,
  Monaco 0.57 from npm loaded on first use.
- **The wrapper's own example** in the Angular project
  (`projects/example`), shaped like the cosmic app: NgModule bootstrap, zone
  change detection, Monaco 0.46 loaded as AMD (`window.monaco`), and the
  parser bundled and initialised by the app.
