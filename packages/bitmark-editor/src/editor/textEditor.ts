import type { ContentChange } from '@gmb/bitmark-parser';
import type * as MonacoApi from 'monaco-editor';

import { toChange } from '../monaco/documentTracker.js';
import { BITMARK_MODEL_SCHEME } from '../monaco/jsonSchema.js';
import type { Monaco, TextModel } from '../monaco/types.js';
import { splitsPair, textEdits } from '../scroll/textChange.js';

/**
 * Passes on only a value that differs from the last one the editor held
 * (reported, or set programmatically). Monaco can apply one input as many
 * edits and fire a content change for each after the batch, every one
 * reading the same final text: without this filter, each would re-run the
 * whole conversion pipeline.
 */
export const createChangeFilter = (initial: string) => {
  let last: string | undefined = initial;
  /** The model holds `last` character for character (not with other line ends). */
  let held = true;
  return {
    /**
     * The text the model held before the change now reported, for the
     * changes that start from it (PLAN-043 D2); `undefined` when that is
     * not known: after `forget`, and after a text the model took with its
     * own line ends.
     */
    get base(): string | undefined {
      return held ? last : undefined;
    },
    /** True, and remembered, when `next` (the model's text) differs from the last value. */
    changed: (next: string): boolean => {
      if (next === last) return false;
      last = next;
      held = true;
      return true;
    },
    /**
     * The editor was given `next` without it being reported (programmatic
     * change). `asIs`: the model holds it character for character.
     */
    set: (next: string, asIs = true): void => {
      last = next;
      held = asIs;
    },
    /** The editor holds a text that was not seen here: the next value counts as changed. */
    forget: (): void => {
      last = undefined;
    },
  };
};

/**
 * Whether a model whose line ends are `eol` holds `text` character for
 * character: Monaco gives every line end of a text it takes the model's own.
 */
export const heldAsIs = (text: string, eol: string): boolean =>
  eol === '\n' ? !text.includes('\r') : !/\r(?!\n)|(^|[^\r])\n/.test(text);

/**
 * Replace a model's text as one undoable edit, not `setValue`: the pane's
 * undo stack survives regeneration (PLAN-022 D16). Only the stretches that
 * changed are replaced (PLAN-031 D3), so every other line keeps its syntax
 * colours, decorations and markers: a regeneration after each keystroke
 * does not flash the pane uncoloured. The cursor is clamped by Monaco;
 * scroll is left where it was. The model ends with `given`, its line ends
 * in the model's own form.
 */
export const replaceAllKeepingUndo = (model: TextModel, given: string): void => {
  // The model gives every line end of a text it takes its own form. Compared
  // in that form, a text that differs in its line ends alone changes
  // nothing, and no CRLF of the text is cut in two by a stretch's edge
  // (the half put in would be taken for a line end of its own).
  const eol = model.getEOL();
  const text = heldAsIs(given, eol) ? given : given.replace(/\r\n|\r|\n/g, eol);
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

/**
 * How an edit got from one text to the next (PLAN-043 D1): known to the
 * editor that was typed in, so nobody has to find it by comparing the two.
 */
export interface EditChanges {
  /** The text the changes start from. */
  base: string;
  /** Applied in this order, each to the text the one before left. */
  changes: readonly ContentChange[];
}

/** `monaco.editor.EndOfLineSequence.LF`. */
const LF = 0;

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
  /**
   * A user edit: the editor's new text (filtered: once per distinct value),
   * and the changes that made it from the last text reported or set, where
   * Monaco's event tells them (PLAN-043 D2).
   */
  onInput?: (value: string, changes?: EditChanges) => void;
  /**
   * A user edit as Monaco reports it, before `onInput`. Returning true takes
   * it: the text is then not read, and `onInput` is not called (PLAN-035 D7).
   */
  onEdit?: (event: MonacoApi.editor.IModelContentChangedEvent) => boolean;
  /** The text was changed programmatically (`setValue`, `applyEdits`). */
  onReplaced?: () => void;
}

/** An edit of the text shown: an LSP range (0-based) replaced by `newText`. */
export interface ViewEdit {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  newText: string;
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
  /**
   * Apply `edits` (ranges in the text shown, in order and not overlapping) as
   * one undoable edit that is not reported as input (PLAN-035 D6). `text` is
   * the text shown, which the caller knows; returns the text after the edits.
   * Neither is read from the model, so the cost is the edits' own.
   */
  applyEdits(edits: readonly ViewEdit[], text: string): string;
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
  // A model made empty takes the platform's line ending, CRLF on Windows,
  // and turns every text it is given into it. The text shown is the
  // parser's, which is LF: offsets in the one are then offsets in the other.
  if (!options.value) model.setEOL(LF);
  const editor = monaco.editor.create(element, {
    automaticLayout: true,
    ...options.editorOptions,
    model,
    readOnly: options.readOnly ?? options.editorOptions?.readOnly ?? false,
  });
  const filter = createChangeFilter(model.getValue());
  let programmatic = false;

  const listener = model.onDidChangeContent((event) => {
    if (programmatic) {
      options.onReplaced?.();
      return;
    }
    if (options.onEdit?.(event)) {
      // Taken without the text being read: what the filter last saw is no longer what the editor holds.
      filter.forget();
      return;
    }
    const base = filter.base;
    const value = model.getValue();
    if (!filter.changed(value)) return;
    // The event's changes turn the last text into this one, unless more was
    // changed since (several events arrive after all their changes were made:
    // the text read here then holds the later ones too), or it is a whole
    // replacement, which says nothing a comparison would not, or the line
    // ends alone changed, which no change tells.
    // And they must add up: an event can be several put together, of which a
    // change of the line ends tells no change of its own.
    const told =
      base !== undefined &&
      !event.isFlush &&
      !event.isEolChange &&
      event.changes.length > 0 &&
      event.versionId === model.getVersionId() &&
      event.changes.every((c) => c.range) &&
      event.changes.reduce((length, c) => length + c.text.length - c.rangeLength, base.length) ===
        value.length;
    options.onInput?.(value, told ? { base, changes: event.changes.map(toChange) } : undefined);
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
      // With other line ends than the model's, the model's text is not
      // `text`; nor is it if the model took it in any other way of its own.
      filter.set(text, heldAsIs(text, model.getEOL()) && model.getValueLength() === text.length);
      return true;
    },
    applyEdits: (edits, text) => {
      const monacoPosition = (p: ViewEdit['range']['start']) => ({
        lineNumber: p.line + 1,
        column: p.character + 1,
      });
      // The offsets, from the text still shown: the result is put together from them.
      const spans = edits.map((e) => ({
        from: monacoPosition(e.range.start),
        to: monacoPosition(e.range.end),
        text: e.newText,
      }));
      let result = '';
      let at = 0;
      for (const span of spans) {
        result += text.slice(at, model.getOffsetAt(span.from)) + span.text;
        at = model.getOffsetAt(span.to);
      }
      result += text.slice(at);
      programmatic = true;
      try {
        model.pushStackElement();
        model.pushEditOperations(
          [],
          spans.map((span) => ({
            range: {
              startLineNumber: span.from.lineNumber,
              startColumn: span.from.column,
              endLineNumber: span.to.lineNumber,
              endColumn: span.to.column,
            },
            text: span.text,
          })),
          () => null,
        );
        model.pushStackElement();
      } finally {
        programmatic = false;
      }
      // The result is put together, not read: the next edit starts from an unknown text.
      filter.set(result, false);
      return result;
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
