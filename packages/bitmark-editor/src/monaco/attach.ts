import type { BitmarkEngine } from '../engine/types.js';
import { log } from '../log.js';
import { attachBitmarkDiagnostics } from './diagnostics.js';
import { attachBitmarkDocument } from './documentTracker.js';
import { attachBitmarkHighlighter } from './highlighter.js';
import { bindModelEngine, setupBitmarkMonaco } from './setup.js';
import type { CodeEditor, IDisposable, Monaco } from './types.js';

export interface BitmarkEditorServices extends IDisposable {
  /** Switch the engine (or `undefined`: none yet). Highlighting and markers re-run. */
  setEngine(engine: BitmarkEngine | undefined): void;
}

export interface AttachBitmarkEditorOptions {
  /** Highlight from the parser's tokens. Default true. */
  highlight?: boolean;
  /** Mark from the parser's diagnostics. Default true (an editable bitmark pane). */
  diagnostics?: boolean;
}

/** Contribution ids differ between Monaco versions; any one means it is there. */
const SUGGEST_IDS = ['editor.contrib.suggestController'];
const HOVER_IDS = ['editor.contrib.contentHover', 'editor.contrib.hover'];

const hasContribution = (editor: CodeEditor, ids: string[]): boolean =>
  ids.some((id) => {
    try {
      return !!editor.getContribution(id);
    } catch {
      return false;
    }
  });

/**
 * The bitmark editor services on one editor (PLAN-022 D8, D14): highlighting,
 * diagnostics, and the completion and hover the providers give for its
 * model. The engine may arrive later (`setEngine`).
 */
export const attachBitmarkEditor = (
  monaco: Monaco,
  editor: CodeEditor,
  engine: BitmarkEngine | undefined,
  options: AttachBitmarkEditorOptions = {},
): BitmarkEditorServices => {
  setupBitmarkMonaco({ monaco });
  let current = engine;
  const get = () => current;

  // Capability check (D8): the host's Monaco may lack contributions.
  if (!hasContribution(editor, SUGGEST_IDS)) {
    log.warnOnce(
      'no-suggest',
      'this Monaco has no suggest contribution: bitmark completion is off',
    );
  }
  if (!hasContribution(editor, HOVER_IDS)) {
    log.warnOnce('no-hover', 'this Monaco has no hover contribution: bitmark hover is off');
  }

  let unbind: (() => void) | undefined;
  const bind = () => {
    unbind?.();
    const model = editor.getModel();
    unbind = model ? bindModelEngine(model, get) : undefined;
  };
  bind();
  const modelListener = editor.onDidChangeModel(bind);

  // The text as a document in the engine, where it has them (PLAN-035 D2);
  // the highlighter and the diagnostics run again once one has opened.
  const parts: { refresh(): void; dispose(): void }[] = [];
  const document =
    options.highlight !== false || options.diagnostics !== false
      ? attachBitmarkDocument(editor, get, () => {
          for (const p of parts) p.refresh();
        })
      : undefined;
  if (options.highlight !== false) {
    parts.push(attachBitmarkHighlighter(monaco, editor, get, undefined, document));
  }
  if (options.diagnostics !== false) {
    parts.push(attachBitmarkDiagnostics(monaco, editor, get, undefined, document));
  }

  return {
    setEngine: (next) => {
      if (next === current) return;
      current = next;
      document?.refresh();
      for (const p of parts) p.refresh();
    },
    dispose: () => {
      modelListener.dispose();
      unbind?.();
      for (const p of parts) p.dispose();
      document?.dispose();
    },
  };
};
