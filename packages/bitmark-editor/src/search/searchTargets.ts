import type * as MonacoApi from 'monaco-editor';

/** What the search needs from a Monaco editor. */
export type SearchEditor = Pick<
  MonacoApi.editor.ICodeEditor,
  | 'getModel'
  | 'onDidChangeModelContent'
  | 'onDidChangeModel'
  | 'onDidFocusEditorText'
  | 'createDecorationsCollection'
  | 'getSelection'
  | 'setSelection'
  | 'revealRangeInCenter'
  | 'hasTextFocus'
  | 'focus'
  | 'getRawOptions'
  | 'executeEdits'
  | 'pushUndoStop'
>;

/** An editor the search covers, as the host registers it. */
export interface SearchTarget {
  /**
   * Where the editor is on screen (a host's own name: `left`, `right`…).
   * One editor per area is searched: the latest registered.
   */
  readonly area: string;
  /** Its name in the results (a tab's label, say). */
  readonly label: string;
  readonly editor: SearchEditor;
  /**
   * Set for an editor that is mounted but not shown: it is not highlighted,
   * and a hidden source can read its text (`hiddenPane`).
   */
  readonly hiddenTab?: string;
}

export interface SearchTargets {
  /** Add a target; returns its removal. */
  register(target: SearchTarget): () => void;
  /** The editors on screen, one per area (the latest registered), in area order. */
  live(): readonly SearchTarget[];
  /** The mounted but hidden editor for a tab, if any. */
  hiddenPane(tab: string): SearchTarget | undefined;
  /** Every registered target (live and hidden). */
  all(): readonly SearchTarget[];
  /** Where an area is in the order of the areas. */
  areaOrder(area: string): number;
  onChange(listener: () => void): () => void;
}

/**
 * The editors the search can see, registered by what mounts them (PLAN-040
 * D2). `areas` is their order on screen; an area it does not name comes after
 * those it does, in the order the areas were first registered.
 */
export const createSearchTargets = (areas: readonly string[] = []): SearchTargets => {
  const order = [...areas];
  const entries: SearchTarget[] = [];
  const listeners = new Set<() => void>();
  const emit = () => [...listeners].forEach((l) => l());
  const areaOrder = (area: string) => {
    const at = order.indexOf(area);
    return at === -1 ? order.length : at;
  };

  return {
    register(target) {
      if (!order.includes(target.area)) order.push(target.area);
      entries.push(target);
      emit();
      return () => {
        const at = entries.indexOf(target);
        if (at === -1) return;
        entries.splice(at, 1);
        emit();
      };
    },
    live() {
      const byArea = new Map<string, SearchTarget>();
      for (const t of entries) if (!t.hiddenTab) byArea.set(t.area, t);
      return [...byArea.values()].sort((a, b) => areaOrder(a.area) - areaOrder(b.area));
    },
    hiddenPane(tab) {
      return entries.filter((t) => t.hiddenTab === tab).pop();
    },
    all() {
      return [...entries];
    },
    areaOrder,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
