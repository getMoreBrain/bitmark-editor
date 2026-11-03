import type { Monaco } from '../monaco/types.js';
import { THEME_CLASS, TokenKey, TokenStyle, tokenVar } from './tokens.js';

export type ThemeBase = 'dark' | 'light';

/** A theme built on `dark`, `light` or `auto`, with token overrides (PLAN-022 D11). */
export interface CustomTheme {
  base: ThemeBase | 'auto';
  /** A Monaco theme the host registered with `defineTheme`. Default: `vs-dark` / `vs`. */
  monacoTheme?: string;
  /** Per token type or modifier: the properties to change. */
  tokens?: Partial<Record<TokenKey, Partial<TokenStyle>>>;
  /** The scroll-sync guide line's colour (PLAN-028 D7), any CSS colour. */
  syncLine?: string;
  /** The matching block's background (PLAN-028 D8), any CSS colour. */
  syncMatch?: string;
}

/** The CSS custom properties a custom theme's own colours set. */
const THEME_VARS = { syncLine: '--bm-sync-line', syncMatch: '--bm-sync-match' } as const;

export type BitmarkTheme = ThemeBase | 'auto' | CustomTheme;

/** The palette a pane uses without a theme: the token styles' own fallbacks. */
export const DEFAULT_THEME: ThemeBase = 'dark';

export interface ApplyThemeOptions {
  /** The Monaco to set the theme on, when `applyMonacoTheme` is true. */
  monaco?: Monaco;
  /**
   * Call `monaco.editor.setTheme`. Monaco's theme is global per instance, so
   * the package does this only when it owns Monaco (`/bundled`) or the host
   * asks; an injected Monaco keeps the host's theme (D11).
   */
  applyMonacoTheme?: boolean;
  /** For tests: the media query source. */
  matchMedia?: (query: string) => MediaQueryList;
}

export interface AppliedTheme {
  setTheme(theme: BitmarkTheme): void;
  /** The base in effect now (`auto` resolved). */
  readonly base: ThemeBase;
  dispose(): void;
}

const PROPS: { key: keyof TokenStyle; name: 'color' | 'weight' | 'style' | 'decoration' }[] = [
  { key: 'color', name: 'color' },
  { key: 'fontWeight', name: 'weight' },
  { key: 'fontStyle', name: 'style' },
  { key: 'textDecoration', name: 'decoration' },
];

/**
 * Theme `element` (a pane, or any ancestor of its editor): the theme class
 * picks the palette's variables, a custom theme's overrides go on the
 * element itself, and `auto` follows `prefers-color-scheme` live.
 */
export const applyBitmarkTheme = (
  element: HTMLElement,
  theme: BitmarkTheme,
  options: ApplyThemeOptions = {},
): AppliedTheme => {
  const media = (options.matchMedia ?? globalThis.matchMedia?.bind(globalThis))?.(
    '(prefers-color-scheme: dark)',
  );
  let current = theme;
  let base: ThemeBase = 'dark';
  let inlineVars: string[] = [];

  const apply = () => {
    const custom = typeof current === 'object' ? current : undefined;
    const name = custom ? custom.base : (current as ThemeBase | 'auto');
    base = name === 'auto' ? (media?.matches === false ? 'light' : 'dark') : name;

    element.classList.remove(THEME_CLASS.dark, THEME_CLASS.light);
    element.classList.add(THEME_CLASS[base]);

    for (const v of inlineVars) element.style.removeProperty(v);
    inlineVars = [];
    for (const [key, style] of Object.entries(custom?.tokens ?? {}) as [
      TokenKey,
      Partial<TokenStyle>,
    ][]) {
      for (const { key: prop, name: varName } of PROPS) {
        const value = style[prop];
        if (value === undefined) continue;
        const v = tokenVar(key, varName);
        element.style.setProperty(v, value);
        inlineVars.push(v);
      }
    }
    for (const [key, v] of Object.entries(THEME_VARS) as [keyof typeof THEME_VARS, string][]) {
      const value = custom?.[key];
      if (value === undefined) continue;
      element.style.setProperty(v, value);
      inlineVars.push(v);
    }

    if (options.applyMonacoTheme && options.monaco) {
      options.monaco.editor.setTheme(custom?.monacoTheme ?? (base === 'dark' ? 'vs-dark' : 'vs'));
    }
  };

  const onMedia = () => {
    const name = typeof current === 'object' ? current.base : current;
    if (name === 'auto') apply();
  };
  media?.addEventListener?.('change', onMedia);
  apply();

  return {
    setTheme: (next) => {
      current = next;
      apply();
    },
    get base() {
      return base;
    },
    dispose: () => {
      media?.removeEventListener?.('change', onMedia);
      element.classList.remove(THEME_CLASS.dark, THEME_CLASS.light);
      for (const v of inlineVars) element.style.removeProperty(v);
      inlineVars = [];
    },
  };
};
