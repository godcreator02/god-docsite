/** 切行：CRLF 与 LF 混用的行尾在这里统一去掉，后面的正则不用再处理 \r。 */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}
