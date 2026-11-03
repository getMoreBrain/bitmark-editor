/**
 * The panes' own layout and banner styles, once per document. Colours come
 * from CSS custom properties a host (or a custom theme) can set
 * (`--bm-banner-*`, `--bm-sync-line` for the scroll-sync guide line,
 * `--bm-sync-match` for the matching block), with dark and light defaults.
 */
export const PANE_CSS = `
.bm-pane{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;position:relative}
.bm-pane-editor{flex:1 1 auto;min-height:0;position:relative}
.bm-pane-sync-line{position:absolute;left:0;right:0;height:0;border-top:1px dashed var(--bm-sync-line,rgba(255,255,255,.35));pointer-events:none;z-index:5}
.bm-pane-sync-line[hidden]{display:none}
.bm-sync-match{background:var(--bm-sync-match,rgba(255,196,0,.14))}
.bm-theme-light .bm-pane-sync-line,.bm-theme-light.bm-pane .bm-pane-sync-line{border-top-color:var(--bm-sync-line,rgba(0,0,0,.35))}
.bm-theme-light .bm-sync-match,.bm-theme-light.bm-pane .bm-sync-match{background:var(--bm-sync-match,rgba(255,196,0,.22))}
.bm-pane-banner{flex:0 0 auto;padding:2px 8px;font:12px/1.5 system-ui,sans-serif;background:var(--bm-banner-bg,#3a2d00);color:var(--bm-banner-fg,#ffd479)}
.bm-pane-banner[hidden]{display:none}
.bm-theme-light .bm-pane-banner,.bm-theme-light.bm-pane .bm-pane-banner{background:var(--bm-banner-bg,#fff8c5);color:var(--bm-banner-fg,#4d2d00)}
.bm-stale .bm-pane-editor{opacity:var(--bm-stale-opacity,.6)}
`;

export const injectPaneCss = (): void => {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-bitmark-panes]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-bitmark-panes', '');
  style.textContent = PANE_CSS;
  document.head.appendChild(style);
};
