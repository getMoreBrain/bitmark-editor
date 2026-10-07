// The theme toggle: system → light → dark. An explicit choice is stored and
// stamped on <html> as data-theme (the head script applies it before first
// paint). The live editors on the page follow: `auto` for system, else the
// choice, which /bundled also applies to its Monaco.
const KEY = 'bitmark-editor-docs-theme';
const ORDER = ['system', 'light', 'dark'];
const LABEL = { system: 'Theme: follow the system', light: 'Theme: light', dark: 'Theme: dark' };

const stored = () => {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
};

const apply = (theme) => {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.dataset.state = theme;
    button.setAttribute('aria-label', LABEL[theme]);
    button.title = LABEL[theme];
  }
  for (const session of document.querySelectorAll('bitmark-session, bitmark-editor')) {
    session.setAttribute('theme', theme === 'system' ? 'auto' : theme);
  }
};

apply(stored());

for (const button of document.querySelectorAll('[data-theme-toggle]')) {
  button.addEventListener('click', () => {
    const next = ORDER[(ORDER.indexOf(stored()) + 1) % ORDER.length];
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    apply(next);
  });
}
