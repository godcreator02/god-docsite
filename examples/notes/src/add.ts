/** 子命令 add：记一条，带上今天的日期 */
import { load, save } from "./store.ts";

export function add(text: string): void {
  const notes = load();
  notes.push({ text, at: new Date().toISOString().slice(0, 10) });
  save(notes);
  console.log(`记下了：${text}`);
}
