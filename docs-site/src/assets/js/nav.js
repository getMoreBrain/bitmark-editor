// The sidebar on narrow screens.
const toggle = document.querySelector('.menu-toggle');
const sidebar = document.getElementById('sidebar');
const backdrop = document.querySelector('.sidebar-backdrop');

const setOpen = (open) => {
  document.body.classList.toggle('sidebar-open', open);
  toggle?.setAttribute('aria-expanded', String(open));
  if (backdrop) backdrop.hidden = !open;
};

toggle?.addEventListener('click', () => setOpen(!document.body.classList.contains('sidebar-open')));
backdrop?.addEventListener('click', () => setOpen(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setOpen(false);
});
sidebar?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });

// The search button: icon-only on narrow screens.
const trigger = document.querySelector('pagefind-modal-trigger');
const narrow = matchMedia('(max-width: 600px)');
const compact = () => trigger?.toggleAttribute('compact', narrow.matches);
compact();
narrow.addEventListener('change', compact);
