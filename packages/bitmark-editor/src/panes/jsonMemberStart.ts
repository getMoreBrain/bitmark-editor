const isSpace = (c: string | undefined): boolean =>
  c === ' ' || c === '\n' || c === '\r' || c === '\t';

/**
 * Where the member holding the JSON value at `offset` starts in `json`
 * (PLAN-028 D8): back over the `[` of an array it opens and the `"key":`
 * naming it, so `"id": [ "a1" ]` starts at `"id"`, not at `"a1"`. Never
 * back over a `,` or a `{`: a later element, or a value that is not its
 * object's whole content, starts where it is.
 */
export const jsonMemberStart = (json: string, offset: number): number => {
  let at = offset;
  for (;;) {
    let j = at;
    while (j > 0 && isSpace(json[j - 1])) j--;
    const c = json[j - 1];
    if (c === '[') {
      at = j - 1;
    } else if (c === ':') {
      let q = j - 1;
      while (q > 0 && isSpace(json[q - 1])) q--;
      if (json[q - 1] !== '"') return at;
      // The key's opening quote: the first `"` before it with an even
      // number of `\` in front.
      let open = q - 2;
      for (; open >= 0; open--) {
        if (json[open] !== '"') continue;
        let slashes = 0;
        while (json[open - 1 - slashes] === '\\') slashes++;
        if (slashes % 2 === 0) break;
      }
      if (open < 0) return at;
      at = open;
    } else {
      return at;
    }
  }
};
