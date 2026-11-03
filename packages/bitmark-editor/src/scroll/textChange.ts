/**
 * What changed between two texts, as one replaced stretch: `before[start,
 * oldEnd)` became `after[start, newEnd)` — the longest common prefix and
 * suffix kept (PLAN-028 D5).
 */
export interface TextChange {
  start: number;
  oldEnd: number;
  newEnd: number;
}

export const textChange = (before: string, after: string): TextChange => {
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  let end = 0;
  while (
    end < max - start &&
    before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)
  ) {
    end++;
  }
  return { start, oldEnd: before.length - end, newEnd: after.length - end };
};

/**
 * Where `offset` in the text before `change` is after it: unmoved before the
 * changed stretch, shifted past it, and at its start inside it.
 */
export const moveOffset = (offset: number, change: TextChange): number =>
  offset < change.start
    ? offset
    : offset >= change.oldEnd
      ? offset + change.newEnd - change.oldEnd
      : change.start;

/** How far apart, in lines, two texts may get before they are matched again. */
const RESYNC_WINDOW = 64;

interface Line {
  start: number;
  text: string;
}

const linesOf = (text: string): Line[] => {
  const lines: Line[] = [];
  let start = 0;
  while (start < text.length) {
    const nl = text.indexOf('\n', start);
    const end = nl < 0 ? text.length : nl + 1;
    lines.push({ start, text: text.slice(start, end) });
    start = end;
  }
  return lines;
};

/**
 * The next lines `a[i']` and `b[j']`, at or after `i` and `j`, where the two
 * texts agree again: the nearest pair that matches, when the line says
 * something (more than a few characters) or the line after it matches too
 * (a lone `},` matches anywhere).
 */
const resync = (a: Line[], b: Line[], i: number, j: number): [number, number] | undefined => {
  const same = (x: number, y: number) => a[x]!.text === b[y]!.text;
  for (let s = 1; s <= 2 * RESYNC_WINDOW; s++) {
    for (let di = Math.max(0, s - RESYNC_WINDOW); di <= Math.min(s, RESYNC_WINDOW); di++) {
      const x = i + di;
      const y = j + s - di;
      if (x >= a.length || y >= b.length || !same(x, y)) continue;
      if (
        a[x]!.text.trim().length > 3 ||
        x + 1 >= a.length ||
        y + 1 >= b.length ||
        same(x + 1, y + 1)
      ) {
        return [x, y];
      }
    }
  }
  return undefined;
};

/** Runs of lines the two texts share, in order: [start in before, start in after, length]. */
type Run = [number, number, number];

const sharedRuns = (before: string, after: string): Run[] => {
  const a = linesOf(before);
  const b = linesOf(after);
  const runs: Run[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i]!.text !== b[j]!.text) {
      const next = resync(a, b, i, j);
      if (!next) break;
      [i, j] = next;
      continue;
    }
    const last = runs[runs.length - 1];
    if (last && last[0] + last[2] === a[i]!.start && last[1] + last[2] === b[j]!.start) {
      last[2] += a[i]!.text.length;
    } else {
      runs.push([a[i]!.start, b[j]!.start, a[i]!.text.length]);
    }
    i++;
    j++;
  }
  return runs;
};

/** Whether `change` stays within one line of both texts (a keystroke). */
const withinLine = (before: string, after: string, change: TextChange): boolean =>
  !before.slice(change.start, change.oldEnd).includes('\n') &&
  !after.slice(change.start, change.newEnd).includes('\n');

/**
 * Where each offset of `before` is in `after`, through any number of changes
 * (PLAN-028 D5): lines the two share keep their place; inside each changed
 * stretch between them, {@link moveOffset} over that stretch alone. One
 * change within a line (a keystroke) needs no line walk.
 */
export const offsetMap = (before: string, after: string): ((offset: number) => number) => {
  const change = textChange(before, after);
  if (withinLine(before, after, change)) return (offset) => moveOffset(offset, change);
  const runs = sharedRuns(before, after);
  return (offset) => {
    // The last run starting at or before `offset`.
    let lo = 0;
    let hi = runs.length - 1;
    let k = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (runs[mid]![0] <= offset) {
        k = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const run = runs[k];
    if (run && offset < run[0] + run[2]) return run[1] + offset - run[0];
    // In the changed stretch between run `k` and the next.
    const oldFrom = run ? run[0] + run[2] : 0;
    const newFrom = run ? run[1] + run[2] : 0;
    const next = runs[k + 1];
    const oldTo = next ? next[0] : before.length;
    const newTo = next ? next[1] : after.length;
    const gap = textChange(before.slice(oldFrom, oldTo), after.slice(newFrom, newTo));
    return newFrom + moveOffset(offset - oldFrom, gap);
  };
};

/** One replaced stretch: `before[oldStart, oldEnd)` became `after[newStart, newEnd)`. */
export interface TextEdit {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
}

/**
 * The stretches that changed between two texts, in order and apart (PLAN-031
 * D3): between the lines they share, each trimmed to where the texts differ.
 * Two changes far apart (a value, and the source echoed at the end of the
 * JSON) are two edits, not one that spans everything between them.
 */
export const textEdits = (before: string, after: string): TextEdit[] => {
  if (before === after) return [];
  const change = textChange(before, after);
  const runs = withinLine(before, after, change) ? [] : sharedRuns(before, after);
  if (runs.length === 0) {
    return [
      {
        oldStart: change.start,
        oldEnd: change.oldEnd,
        newStart: change.start,
        newEnd: change.newEnd,
      },
    ];
  }
  const edits: TextEdit[] = [];
  let oldFrom = 0;
  let newFrom = 0;
  for (const [oldAt, newAt, length] of [...runs, [before.length, after.length, 0] as Run]) {
    if (oldAt > oldFrom || newAt > newFrom) {
      const gap = textChange(before.slice(oldFrom, oldAt), after.slice(newFrom, newAt));
      edits.push({
        oldStart: oldFrom + gap.start,
        oldEnd: oldFrom + gap.oldEnd,
        newStart: newFrom + gap.start,
        newEnd: newFrom + gap.newEnd,
      });
    }
    oldFrom = oldAt + length;
    newFrom = newAt + length;
  }
  return edits;
};
