/**
 * `call`'s answer and the parser's time for it (PLAN-044): the engine's own
 * where the answer tells one, and else how long the call took, from before
 * it was made (an engine may do its work before it returns its promise).
 */
export const withParseMs = async <T>(
  call: () => Promise<T>,
): Promise<{ value: T; parseMs: number }> => {
  const started = performance.now();
  const value = await call();
  const told = (value as { parseMs?: unknown } | null | undefined)?.parseMs;
  return { value, parseMs: typeof told === 'number' ? told : performance.now() - started };
};
