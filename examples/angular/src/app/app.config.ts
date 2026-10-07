import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideBitmarkEditor } from '@gmb/bitmark-editor-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Defaults for every bm-session. Monaco loads when the first session
    // starts; the parser loads from jsDelivr at the package's pinned version.
    provideBitmarkEditor({ monaco: () => import('./monaco').then((m) => m.monaco) }),
  ],
};
