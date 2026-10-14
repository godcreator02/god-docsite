/** Markdown 换成纯文字的几行：去掉标题、引用、列表、链接、强调这些记号，一段一行，空行与代码块的围栏去掉 */
export function plainLinesOf(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !/^\s*(```|~~~)/.test(line))
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*>\s?/, '')
        .replace(/^\s*([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__|~~|`)/g, '')
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .trim(),
    )
    .filter((line) => line !== '' && !/^[-:| ]+$/.test(line))
}
