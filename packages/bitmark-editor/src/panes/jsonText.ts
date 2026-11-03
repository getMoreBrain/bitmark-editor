import type { OutputMode } from '@gmb/bitmark-parser';

import type { Anchor, BitmarkEngine } from '../engine/types.js';
import { jsonMemberStart } from './jsonMemberStart.js';

/** Engines found to give no bit anchors (before parser 7.19): asked once (PLAN-029 R4). */
const withoutAnchors = new WeakSet<BitmarkEngine>();

/**
 * The document's JSON as the JSON pane shows it and `session.getJson()`
 * returns it (PLAN-029 R3): the parser's own pretty JSON, so its bit starts
 * and anchors are offsets into exactly this text (PLAN-028 D3); a parser
 * without anchors, the JSON written by the editor, as before (D2).
 */
export const jsonTextFor = async (
  engine: BitmarkEngine,
  bitmark: string,
  mode: OutputMode | undefined,
): Promise<{ text: string; bitStarts?: readonly number[]; anchors?: readonly Anchor[] }> => {
  if (!engine.capabilities.bitPositions || withoutAnchors.has(engine)) {
    return engine.bitmarkToJsonText(bitmark, { mode });
  }
  const { output, bitStarts, anchors } = await engine.convertWithBitStarts(bitmark, {
    inputFormat: 'bitmark',
    outputFormat: 'json',
    mode,
    pretty: true,
  });
  if (anchors === undefined) {
    withoutAnchors.add(engine);
    return engine.bitmarkToJsonText(bitmark, { mode });
  }
  // A value is shown from the member holding it: its key line (PLAN-028 D8).
  return {
    text: output,
    bitStarts,
    anchors: anchors.map((a) => ({ ...a, output: jsonMemberStart(output, a.output) })),
  };
};
