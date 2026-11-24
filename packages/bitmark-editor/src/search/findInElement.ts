import { findInText, MATCH_CAP, SearchOptions } from './findAll.js';

const SKIPPED_ELEMENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/**
 * Every match of `query` in the text `root` shows, as DOM ranges (PLAN-041
 * D2): for a host's rendered view, to mark with the CSS Custom Highlight API
 * (`CSS.highlights.set(name, new Highlight(...ranges))`), which adds nothing
 * to the view's elements. The text is read as it is laid out: a match can
 * run over several inline elements (a word with a bold part), never from one
 * block into the next. An invalid regex finds nothing.
 */
export const findInElement = (
  root: Element,
  query: string,
  options: SearchOptions,
  cap = MATCH_CAP,
): Range[] => {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (!view) return [];
  const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes: { node: Text; start: number }[] = [];
  const blocks = new Map<Element, Element>();
  /** The nearest ancestor that is not laid out inline: where a line of text ends. */
  const blockOf = (element: Element): Element => {
    let block = blocks.get(element);
    if (!block) {
      const parent = element.parentElement;
      const inline =
        element !== root && view.getComputedStyle(element).display.startsWith('inline');
      block = inline && parent ? blockOf(parent) : element;
      blocks.set(element, block);
    }
    return block;
  };
  let text = '';
  let lastBlock: Element | undefined;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (!node.data || !parent || SKIPPED_ELEMENTS.has(parent.tagName)) continue;
    const block = blockOf(parent);
    if (lastBlock && block !== lastBlock) text += '\n';
    lastBlock = block;
    nodes.push({ node, start: text.length });
    text += node.data;
  }

  const found = findInText(text, query, options, cap);
  if (!found.ok || nodes.length === 0) return [];
  const ranges: Range[] = [];
  let at = 0;
  /** The text node `offset` is in; an end lies in the node it closes, not at the start of the next. */
  const place = (offset: number, isEnd: boolean) => {
    while (at < nodes.length - 1 && nodes[at + 1].start < offset + (isEnd ? 0 : 1)) at++;
    const { node, start } = nodes[at];
    return { node, offset: Math.max(0, Math.min(node.data.length, offset - start)) };
  };
  for (const match of found.matches) {
    const start = place(match.start, false);
    const startAt = at;
    const end = place(match.end, true);
    at = startAt;
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    ranges.push(range);
  }
  return ranges;
};
