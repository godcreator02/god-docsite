/**
 * 假格式包：记号是一行 `REF <记录簿键>`（`REF src/greet.ts:2-3`、`REF tree src depth=1`……），草稿记号交给核心认，
 * write 只重写记号那一行。核心和比较器的测试都用它——核心不认识任何真格式，测它就不该把真格式包拉进来。
 */
import { draftOf, keyToTarget, targetKey } from "@godcreator02/live-doc-core";
import type { Fill, Format, Reference } from "@godcreator02/live-doc-core";

const MARK = /^REF\s+(.+)$/;

export function fakeFormat(name: string, suffix: string): Format {
  return {
    name,
    claims: (doc) => doc.endsWith(suffix),
    marker: (t) => `REF ${targetKey(t)}`,
    parse(text) {
      const refs: Reference[] = [];
      text.split("\n").forEach((line, at) => {
        const m = MARK.exec(line.trim());
        if (m !== null) {
          refs.push({ target: keyToTarget(m[1]!), at });
          return;
        }
        const draft = draftOf(line, `第 ${at + 1} 行`);
        if (draft !== null) refs.push({ target: draft, at, extra: { draft: true } });
      });
      return refs;
    },
    write(text, fills: Fill[]) {
      const lines = text.split("\n");
      for (const fill of fills) lines[fill.reference.at] = `REF ${targetKey(fill.reference.target)}`;
      return lines.join("\n");
    },
  };
}
