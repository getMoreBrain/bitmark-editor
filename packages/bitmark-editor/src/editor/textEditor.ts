import type * as MonacoApi from 'monaco-editor';

import { BITMARK_MODEL_SCHEME } from '../monaco/jsonSchema.js';
import type { Monaco, TextModel } from '../monaco/types.js';
import { textEdits } from '../scroll/textChange.js';

/**
 * Passes on only a value that differs from the last one the editor held
 * (reported, or set programmatically). Monaco can apply one input as many
 * edits and fire a content change for each after the batch, every one
 * reading the same final text: without this filter, each would re-run the
 * whole conversion pipeline.
 */
export const createChangeFilter = (initial: string) => {
  let last = initial;
  return {
    /** True, and remembered, when `next` differs from the last value. */
    changed: (next: string): boolean => {
      if (next === last) return false;
      last = next;
      return true;
    },
    /** The editor now holds `next` without it being reported (programmatic change). */
    set: (next: string): void => {
      last = next;
    },
  };
};

/** Whether `code` is the first half of a UTF-16 surrogate pair, or a CR (of a CRLF). */
const splitsPair = (code: number): boolean => (code >= 0xd800 && code <= 0xdbff) || code === 13;

/**
 * Replace a model's text as one undoable edit, not `setValue`: the pane's
 * undo stack survives regeneration (PLAN-022 D16). Only the stretches that
 * changed are replaced (PLAN-031 D3), so every other line keeps its syntax
 * colours, decorations and markers: a regeneration after each keystroke
 * does not flash the pane uncoloured. The cursor is clamped by Monaco;
 * scroll is left where it was.
 */
export const replaceAllKeepingUndo = (model: TextModel, text: string): void => {
  const before = model.getValue();
  if (before === text) return;
  const operations = textEdits(before, text).map((e) => {
    let { oldStart, oldEnd, newStart, newEnd } = e;
    // Never split a surrogate pair or a CRLF: widen the stretch over it
    // (the characters around a stretch are the same in both texts).
    if (oldStart > 0 && splitsPair(before.charCodeAt(oldStart - 1))) {
      oldStart--;
      newStart--;
    }
    if (oldEnd > oldStart && oldEnd < before.length && splitsPair(before.charCodeAt(oldEnd - 1))) {
      oldEnd++;
      newEnd++;
    }
    const from = model.getPositionAt(oldStart);
    const to = model.getPositionAt(oldEnd);
    return {
      range: {
        startLineNumber: from.lineNumber,
        startColumn: from.column,
        endLineNumber: to.lineNumber,
        endColumn: to.column,
      },
      text: text.slice(newStart, newEnd),
    };
  });
  model.pushStackElement();
  model.pushEditOperations([], operations, () => null);
  model.pushStackElement();
};

let editorSeq = 0;

/** A fresh model URI under the package scheme (PLAN-022 D5). */
export const createModelUri = (monaco: Monaco, kind: string, extension: string): MonacoApi.Uri =>
  monaco.Uri.parse(`${BITMARK_MODEL_SCHEME}://editor-${++editorSeq}/${kind}.${extension}`);

export interface TextEditorOptions {
  monaco: Monaco;
  value?: string;
  language: string;
  /** The model's file extension, so the schema scope and the language match. Default `txt`. */
  extension?: string;
  /** What the pane is (`bitmark`, `json`, …), for the model URI. */
  kind?: string;
  readOnly?: boolean;
  /** Passed to `monaco.editor.create`. */
  editorOptions?: MonacoApi.editor.IStandaloneEditorConstructionOptions;
  /** A user edit: the editor's new text (filtered: once per distinct value). */
  onInput?: (value: string) => void;
}

export interface TextEditor extends MonacoApi.IDisposable {
  readonly editor: MonacoApi.editor.IStandaloneCodeEditor;
  readonly model: TextModel;
  getValue(): string;
  /**
   * Show `text`, unless the user is typing here (the editor has focus): a
   * focused editor is not overwritten unless `force`. Returns whether it was
   * applied.
   */
  setValue(text: string, options?: { force?: boolean }): boolean;
  setReadOnly(readOnly: boolean): void;
  layout(): void;
}

/**
 * One Monaco editor on its own model, in plain TypeScript (PLAN-023 Step 6):
 * user edits are reported once per distinct value, a programmatic value never
 * echoes back as input, a focused editor is never overwritten, regeneration
 * keeps undo, and the editor lays itself out as its element resizes.
 */
export const createTextEditor = (element: HTMLElement, options: TextEditorOptions): TextEditor => {
  const { monaco } = options;
  const model = monaco.editor.createModel(
    options.value ?? '',
    options.language,
    createModelUri(monaco, options.kind ?? 'text', options.extension ?? 'txt'),
  );
  const editor = monaco.editor.create(element, {
    automaticLayout: true,
    ...options.editorOptions,
    model,
    readOnly: options.readOnly ?? options.editorOptions?.readOnly ?? false,
  });
  const filter = createChangeFilter(model.getValue());
  let programmatic = false;

  const listener = model.onDidChangeContent(() => {
    if (programmatic) return;
    const value = model.getValue();
    if (filter.changed(value)) options.onInput?.(value);
  });

  return {
    editor,
    model,
    getValue: () => model.getValue(),
    setValue: (text, opts) => {
      if (editor.hasTextFocus() && !opts?.force) return false;
      programmatic = true;
      try {
        replaceAllKeepingUndo(model, text);
      } finally {
        programmatic = false;
      }
      filter.set(text);
      return true;
    },
    setReadOnly: (readOnly) => editor.updateOptions({ readOnly }),
    layout: () => editor.layout(),
    dispose: () => {
      listener.dispose();
      editor.dispose();
      model.dispose();
    },
  };
};
