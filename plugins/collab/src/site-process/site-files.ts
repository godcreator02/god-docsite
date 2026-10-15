/** 协作站功能包的包名：建站后交给 gwbDocsite.addFeature */
export const featurePackage = '@godcreator/collab'

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
