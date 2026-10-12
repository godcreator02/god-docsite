/** 协作站功能包的包名：建站时写进 site/package.json 的 docsite.features */
export const featurePackage = '@godcreator/collab-site'

const ansiEscapePattern = /\u001b\[[0-9;]*m/g

/** 输出的最后几行，去掉颜色控制符与空行 */
export function lastLinesOf(output: string, lineCount = 10): string {
  return output
    .replace(ansiEscapePattern, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .slice(-lineCount)
    .join('\n')
}
