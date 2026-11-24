import type { Range, SemanticToken } from '@gmb/bitmark-parser';
import type * as MonacoApi from 'monaco-editor';

import type { BitmarkEngine } from '../engine/types.js';
import { log } from '../log.js';
import { tokenClassName } from '../theme/tokens.js';
import type { BitmarkDocumentTracker } from './documentTracker.js';
import { attachModelJob, debounce } from './modelJob.js';
import type { CodeEditor, IDisposable, Monaco } from './types.js';

/**
 * Delay between the last edit and re-highlighting. Monaco's own semantic
 * tokens feature waits at least 300 ms per request, which is why the parser
 * tokens are applied directly as decorations instead.
 */
export const HIGHLIGHT_DEBOUNCE_MS = 15;

/** The parser's absolute-layout tokens (0-based, UTF-16) as Monaco decorations. */
export const buildBitmarkDecorations = (
  monaco: Monaco,
  tokens: readonly SemanticToken[],
): MonacoApi.editor.IModelDeltaDecoration[] =>
  tokens.map((t) => ({
    range: new monaco.Range(t.line + 1, t.start + 1, t.line + 1, t.start + t.length + 1),
    options: { inlineClassName: tokenClassName(t.type, t.modifiers) },
  }));

/**
 * The lines to tokenise for what the editor shows: the visible lines and as
 * many again above and below, 0-based (PLAN-035 D3). `undefined` when the
 * editor reports no visible lines (not laid out yet): the whole text.
 */
export const highlightRange = (editor: CodeEditor): Range | undefined => {
  const visible = editor.getVisibleRanges?.() ?? [];
  if (visible.length === 0) return undefined;
  const first = Math.min(...visible.map((r) => r.startLineNumber));
  const last = Math.max(...visible.map((r) => r.endLineNumber));
  const margin = last - first + 1;
  const lines = editor.getModel()?.getLineCount?.() ?? last + margin;
  return {
    start: { line: Math.max(0, first - 1 - margin), character: 0 },
    end: { line: Math.min(lines, last + margin) - 1, character: 0 },
  };
};

/**
 * Highlight a bitmark editor from the parser's semantic tokens, applied as
 * inline decorations after each change (debounced). A result for an older
 * text is dropped.
 *
 * With a `document` (PLAN-035 D3) only the lines around the visible ones are
 * tokenised and decorated, again after a scroll: the cost of a keystroke no
 * longer grows with the text. Without one the whole text is tokenised.
 */
export const attachBitmarkHighlighter = (
  monaco: Monaco,
  editor: CodeEditor,
  engine: () => BitmarkEngine | undefined,
  debounceMs: number = HIGHLIGHT_DEBOUNCE_MS,
  document?: BitmarkDocumentTracker,
): IDisposable & { refresh(): void } => {
  const decorations = editor.createDecorationsCollection();
  /** The last tokens were for the visible lines only: a scroll needs new ones. */
  let ranged = false;
  const job = attachModelJob({
    editor,
    debounceMs,
    compute: (text) => {
      const e = engine();
      if (!e) return undefined;
      if (!document?.active) {
        ranged = false;
        return e.semanticTokens(text());
      }
      return document.current().then((doc) => {
        const range = doc ? highlightRange(editor) : undefined;
        ranged = !!range;
        if (!doc) return e.semanticTokens(text());
        return doc.semanticTokens(range).catch(() => {
          // The document failed: the whole text, now and from here on.
          document.failed(doc);
          ranged = false;
          return e.semanticTokens(text());
        });
      });
    },
    apply: (_model, result) => {
      if (result.layout !== 'absolute') return;
      decorations.set(buildBitmarkDecorations(monaco, result.tokens));
    },
    clear: () => decorations.clear(),
    onError: (e) => {
      log.error('bitmark semantic tokens failed', e);
      decorations.clear();
    },
  });
  const onScroll = debounce(() => {
    if (ranged) job.run();
  }, debounceMs);
  const scrollListener = document ? editor.onDidScrollChange?.(() => onScroll()) : undefined;
  // More lines come into view without a scroll when the editor is shown or grows.
  const layoutListener = document ? editor.onDidLayoutChange?.(() => onScroll()) : undefined;
  return {
    refresh: job.run,
    dispose: () => {
      onScroll.cancel();
      scrollListener?.dispose();
      layoutListener?.dispose();
      job.dispose();
      decorations.clear();
    },
  };
};
