// The custom elements (PLAN-022 D3). Importing this module defines them
// (in a browser; a no-op during server rendering).
import { defineBitmarkElements } from './elements.js';

defineBitmarkElements();

export {
  getDefaultEngine,
  loadDefaultMonaco,
  setDefaultEngine,
  setMonacoLoader,
} from './defaults.js';
export type {
  BitmarkEditorElementApi,
  BitmarkPaneElementApi,
  BitmarkSessionElementApi,
  LazyMode,
  NarrowMode,
  PaneEditorOptions,
} from './elements.js';
export { defineBitmarkElements, ELEMENTS_CSS, isNarrowTouch } from './elements.js';
