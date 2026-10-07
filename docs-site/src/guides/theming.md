---
title: Theming
lead: Dark, light, auto and custom themes, over CSS variables your site can map onto its own.
---

## Themes

`theme` is a session option, a `<bitmark-session>` attribute and a React or
Angular input:

- `'dark'` (the default) and `'light'`;
- `'auto'`, which follows the OS setting live;
- a custom theme: `{ base, monacoTheme?, tokens? }` ([below](#custom-themes)).

Change it at runtime with `session.setTheme()`, or by changing the attribute
or input. The demos on this site follow its theme toggle.

## Match Monaco's theme

The theme sets the bitmark token colours and the panes' look. Monaco's own
theme (the editor background, the selection, the widgets) is separate, and
page-wide: one Monaco has one theme for every editor on the page.

| Setup | Monaco's theme |
|---|---|
| `/bundled` | Its Monaco is its own, so the session sets it from `theme` |
| Your Monaco, `applyMonacoTheme: true` | The session sets it from `theme` (for `auto`, following the OS) |
| Your Monaco, by default | Left alone: yours to set, starting as light `vs` |

In the last case, set `theme` to match your Monaco: `'light'` for `vs`,
`'dark'` for `vs-dark`. A session without a `theme` there would put the
dark-theme colours on a light editor, and it warns once in the console.

## CSS variables

Token colours are CSS variables, and yours win over the themes'. Set them on
any ancestor of the panes, for example to use your site's syntax colours:

{% highlight "css" %}
.my-docs bitmark-session {
  --bm-tok-bitType-color: var(--syntax-tag);
  --bm-tok-bitSigil-color: var(--syntax-tag);
  --bm-mod-comment-color: gray;
}
{% endhighlight %}

- `--bm-tok-<type>-color`, and `-weight`, `-style`, `-decoration`, for each
  token type below.
- `--bm-mod-<modifier>-color` (and the same three) for the modifiers:
  `comment`, `unclosed`, `bold`, `italic`, `highlight`, `light`.
- The panes: `--bm-banner-bg`, `--bm-banner-fg` (the status banner),
  `--bm-stale-opacity` (a pane showing old content), `--bm-tab-bg`,
  `--bm-tab-fg`, `--bm-tab-active-fg`, `--bm-tab-accent` (tabs) and
  `--bm-split-gap`.

The token types: `frontmatter`, `bitSigil`, `bitType`, `bitFormat`,
`bitResourceType`, `tagSigil`, `propertyKey`, `resourceType`, `tagText`,
`cardDivider`, `sideDivider`, `variantDivider`, `footerDivider`,
`textDivider`, `paragraphBreak`, `headingSigil`, `heading`, `listMarker`,
`codeSigil`, `codeLanguage`, `codeBody`, `imageSigil`, `imageSrc`,
`markSigil`, `bold`, `italic`, `highlight`, `light`, `inline`, `attrSigil`,
`attrKey`, `attrValue`, `url`, `text`, `plainText`.

## Custom themes

A custom theme starts from a base (`dark`, `light` or `auto`) and changes
what you list:

{% highlight "ts" %}
session.setTheme({
  base: 'light',
  monacoTheme: 'my-theme',                  // registered with monaco.editor.defineTheme
  tokens: {
    bitType: { color: '#27187e', fontWeight: 'bold' },
    comment: { fontStyle: 'normal' },
  },
});
{% endhighlight %}

`monacoTheme` is the Monaco theme to use with `applyMonacoTheme` (or in
`/bundled`), instead of `vs` or `vs-dark`.
