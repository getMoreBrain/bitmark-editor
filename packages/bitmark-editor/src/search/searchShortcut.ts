import type { SearchOptions } from './findAll.js';
import type { SearchController } from './searchController.js';
import type { SearchField } from './searchState.js';

const isMacPlatform = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The Latin letter typed; for a key that types no Latin letter (a Cyrillic or
 * Greek layout, or Option on macOS), the key's place on a US keyboard. A
 * Latin layout such as Dvorak keeps its own letters.
 */
const isKey = (e: KeyboardEvent, letter: string) => {
  const key = e.key.toLowerCase();
  return /^[a-z]$/.test(key) ? key === letter : e.code === `Key${letter.toUpperCase()}`;
};

/** Ctrl+H, or Cmd+Alt+F (macOS, where Cmd+H hides the app): Monaco's Replace keys. */
const isReplace = (e: KeyboardEvent, mac: boolean) =>
  e.shiftKey
    ? false
    : e.metaKey && e.altKey
      ? isKey(e, 'f')
      : !mac && e.ctrlKey && !e.altKey && !e.metaKey && isKey(e, 'h');

/** Ctrl+F; Cmd+F too, wherever the platform is unknown or misreported. */
const isFind = (e: KeyboardEvent, mac: boolean) =>
  !e.altKey && !e.shiftKey && (e.metaKey || (!mac && e.ctrlKey)) && isKey(e, 'f');

/** The input a key press asks for: Ctrl+F (Cmd+F) the search's, Ctrl+H (Cmd+Alt+F) the replace's. */
export const searchShortcut = (e: KeyboardEvent, mac = isMacPlatform()): SearchField | undefined =>
  isReplace(e, mac) ? 'replace' : isFind(e, mac) ? 'search' : undefined;

const OPTION_KEYS: Record<string, keyof SearchOptions> = {
  c: 'matchCase',
  w: 'wholeWord',
  r: 'regex',
};

/**
 * The option a key press in a search bar switches, as Monaco's find widget
 * has them: Alt+C match case, Alt+W whole word, Alt+R regex. On macOS they
 * are Cmd+Option+C, +W and +R, read by the key's place: Option alone types
 * a character there (ç, ∑, ®, a letter of another layout), which the bar's
 * inputs must still take. A browser that keeps one of these for itself
 * (Cmd+Option+W) does not ask the page: the bar's button switches it then.
 */
export const searchOptionShortcut = (
  e: KeyboardEvent,
  mac = isMacPlatform(),
): keyof SearchOptions | undefined => {
  if (!e.altKey || e.ctrlKey || e.metaKey !== mac) return undefined;
  return Object.keys(OPTION_KEYS)
    .filter((letter) => isKey(e, letter))
    .map((letter) => OPTION_KEYS[letter])[0];
};

/**
 * The step a key press asks for: F3 the next match and Shift+F3 the previous
 * one, as Monaco's own find has them; Cmd+G and Cmd+Shift+G too on macOS.
 */
export const searchStepShortcut = (e: KeyboardEvent, mac = isMacPlatform()): 1 | -1 | undefined => {
  const plain = !e.altKey && !e.ctrlKey && !e.metaKey;
  const next =
    e.key === 'F3' ? plain : mac && e.metaKey && !e.altKey && !e.ctrlKey && isKey(e, 'g');
  return next ? (e.shiftKey ? -1 : 1) : undefined;
};

export interface SearchShortcutOptions {
  /** Where the keys are listened for; the window by default. */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** The search input: Ctrl+F pressed in it is left to the browser's own find. */
  input?: () => Element | null | undefined;
  /** The search bar: from within it, the query is kept. */
  bar?: () => Element | null | undefined;
}

/**
 * Ctrl+F (Cmd+F on macOS) opens the search from anywhere, before Monaco or
 * the browser see the key (PLAN-040 D8); Ctrl+H (Cmd+Alt+F) opens it on the
 * replace input. The query is the focused editor's selection when that is on
 * one line. F3 and Shift+F3 (Cmd+G, Cmd+Shift+G) step to the next and the
 * previous match. With these taken, no key opens the find widget of a Monaco
 * that has one. Returns the removal.
 */
export const attachSearchShortcut = (
  controller: SearchController,
  options: SearchShortcutOptions = {},
): (() => void) => {
  const target = options.target ?? window;
  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    const direction = searchStepShortcut(e);
    if (direction) {
      e.preventDefault();
      e.stopPropagation();
      controller.step(direction);
      return;
    }
    const field = searchShortcut(e);
    if (!field) return;
    // The key's real target, also where the bar is in a shadow root.
    const origin = e.composedPath?.()[0] ?? e.target;
    const input = options.input?.();
    if (field === 'search' && input && origin === input) return;
    e.preventDefault();
    e.stopPropagation();
    // From within the bar, the query stays (an editor's selection may be its regex's match).
    const bar = options.bar?.();
    const inBar = !!bar && origin instanceof Node && bar.contains(origin);
    controller.open(inBar ? undefined : controller.selectionText(), field);
  };
  target.addEventListener('keydown', onKeyDown, true);
  return () => target.removeEventListener('keydown', onKeyDown, true);
};
