import type * as MonacoApi from 'monaco-editor';

/** The part of a Monaco text model {@link blockEnd} reads. */
export type BlockEndModel = Pick<
  MonacoApi.editor.ITextModel,
  'getPositionAt' | 'getOffsetAt' | 'getValueLength' | 'getLineContent' | 'getLineMaxColumn'
>;

/**
 * Where a highlighted block ends (PLAN-028 D8): at the last line with text
 * before `end` (`undefined`: the end of the text), so a block keeps its own
 * last line, not the blank lines after it; never before `start`. Reads line
 * by line back from the end, not the whole text (PLAN-029 R8).
 */
export const blockEnd = (m: BlockEndModel, start: number, end: number | undefined): number => {
  const first = m.getPositionAt(start).lineNumber;
  let { lineNumber, column } = m.getPositionAt(end ?? m.getValueLength());
  for (;;) {
    const kept = m
      .getLineContent(lineNumber)
      .slice(0, column - 1)
      .trimEnd().length;
    if (kept > 0 || lineNumber <= first) {
      column = kept + 1;
      break;
    }
    lineNumber--;
    column = m.getLineMaxColumn(lineNumber);
  }
  return Math.max(start, m.getOffsetAt({ lineNumber, column }));
};
