# @gmb/bitmark-editor-angular

Angular components for [`@gmb/bitmark-editor`](https://www.npmjs.com/package/@gmb/bitmark-editor):
`bm-session` (a form control), `bm-pane`, `bm-tabs` and `bm-split`.
Angular 21 and 22.

**Guide: https://getmorebrain.github.io/bitmark-editor/guides/angular/**

```sh
npm install @gmb/bitmark-editor @gmb/bitmark-editor-angular monaco-editor
```

```ts
// The app's providers: defaults for every bm-session.
provideBitmarkEditor({
  monaco: () => import('./monaco').then((m) => m.loadMonaco()), // your Monaco, loaded on first use
  applyMonacoTheme: true,                                        // the app owns its Monaco
}),
```

```html
<bm-session [formControl]="content" [theme]="theme()" (change)="onChange($event)" style="height: 320px">
  <bm-split>
    <bm-pane type="bitmark" />
    <bm-tabs>
      <bm-pane type="json" />
      <bm-pane type="html" />
    </bm-tabs>
  </bm-split>
</bm-session>
```

- `bm-session` inputs: `value`, `monaco`, `engine`, `theme`,
  `applyMonacoTheme`, `debounceMs`, `schema`; outputs: `change`, `ready`,
  `error`. As a form control, its value is the bitmark text.
- `bm-pane` inputs: `type`, `mode`, `mapping`, `label`, `readonly`,
  `scrollSync`, `inactive`. It fills its box.
- Monaco and the session run outside the Angular zone.

The [example app](https://github.com/getMoreBrain/bitmark-editor/tree/main/examples/angular)
is a complete zoneless app, including Monaco's workers and styles for
Angular's builder.

## License

ISC
