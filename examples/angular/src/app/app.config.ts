import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideBitmarkEditor } from '@gmb/bitmark-editor-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Defaults for every bm-session. Monaco loads when the first session
    // starts; the parser loads from jsDelivr at the package's pinned version.
    // This app owns its Monaco, so sessions set Monaco's (page-wide) theme
    // from their `theme` too, keeping it matched to the token colours.
    provideBitmarkEditor({
      monaco: () => import('./monaco').then((m) => m.loadMonaco()),
      applyMonacoTheme: true,
    }),
  ],
};
