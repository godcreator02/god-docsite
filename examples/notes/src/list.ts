/** 子命令 list：按记下的顺序列出来 */
import { load } from "./store.ts";

export function list(): void {
  for (const note of load()) console.log(`${note.at}  ${note.text}`);
}
