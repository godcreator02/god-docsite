/**
 * 卡文件名与卡身份。浏览器端（卡页、星轨盘页按身份找页）也用，所以单独一个文件，不带上 YAML 与 schema。
 */

/** 卡文件的后缀：`.md` 与 `.mdx` 都是卡，卡身份是去掉后缀的文件名 */
export const CARD_EXT = /\.mdx?$/;

/** 卡文件名（相对卡目录）去掉后缀就是卡身份 */
export function cardIdOfFile(name: string): string {
  return name.replace(CARD_EXT, "");
}

/** 名单里挑出卡文件：`.md` / `.mdx` 都要，同一身份两者都在只留 `.mdx`；排过序。 */
export function pickCardFiles(names: readonly string[]): string[] {
  const byStem = new Map<string, string>();
  for (const name of [...names].sort()) {
    if (!CARD_EXT.test(name)) continue;
    const stem = cardIdOfFile(name);
    const kept = byStem.get(stem);
    if (kept === undefined || (kept.endsWith(".md") && name.endsWith(".mdx"))) byStem.set(stem, name);
  }
  return [...byStem.values()].sort();
}
