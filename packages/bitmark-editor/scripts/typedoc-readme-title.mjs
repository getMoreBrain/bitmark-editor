// typedoc plugin: the index page shows the project name as its title, then
// the README, which starts with the same name as its own heading. Drop the
// README's heading there, so the title shows once (the README keeps it on npm
// and GitHub).
import { PageEvent } from 'typedoc';

/** @param {import('typedoc').Application} app */
export const load = (app) => {
  app.renderer.on(PageEvent.END, (page) => {
    if (page.url !== 'index.html' || !page.contents) return;
    page.contents = page.contents.replace(/<h1 id="[^"]*" class="tsd-anchor-link">.*?<\/h1>/s, '');
  });
};
