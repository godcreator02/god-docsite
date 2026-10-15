export interface ExportScan {
  /** 导出的值的名字（不含 default） */
  names: string[]
  hasDefault: boolean
  /** export * from '…' 的模块说明符 */
  starFrom: string[]
}

/**
 * 从 TS 源码里认出导出：export const/let/var/function/class 名字、export { a, b as c }（可带 from）、export default、export * from。
 * 跳过 export type / interface 与 { type x }。解构导出这类认不出名字的报错，让作者改成点名的写法。
 * 是词法扫描，不执行代码：建站器在没装依赖、没有 TS 加载器时也要能跑
 */
export function scanExports(source: string, file: string): ExportScan {
  const code = withoutComments(source)
  const scan: ExportScan = { names: [], hasDefault: false, starFrom: [] }
  const exportKeyword = /\bexport\b\s*/g
  for (let match = exportKeyword.exec(code); match !== null; match = exportKeyword.exec(code)) {
    const rest = code.slice(match.index + match[0].length)
    const declared = /^(?:declare\s+)?(?:const|let|var|async\s+function\*?|function\*?|abstract\s+class|class)\s*([A-Za-z_$][\w$]*)/.exec(rest)
    if (declared) {
      scan.names.push(declared[1]!)
      continue
    }
    if (/^default\b/.test(rest)) {
      scan.hasDefault = true
      continue
    }
    const star = /^\*\s*from\s*(['"])([^'"]+)\1/.exec(rest)
    if (star) {
      scan.starFrom.push(star[2]!)
      continue
    }
    if (/^(?:declare\s+)?(?:type|interface)\b/.test(rest) && !/^type\s*\{/.test(rest)) continue
    const braces = /^(type\s*)?\{([^}]*)\}/.exec(rest)
    if (braces) {
      if (braces[1] === undefined) scan.names.push(...namesInExportBraces(braces[2]!))
      continue
    }
    throw new Error(`${file} 里有认不出名字的导出（${rest.split('\n', 1)[0]!.trim()}）：改成 export const 名字 = …、export function 名字 或 export { 名字 }`)
  }
  return scan
}

function namesInExportBraces(inside: string): string[] {
  return inside
    .split(',')
    .map((each) => each.trim())
    .filter((each) => each !== '' && !/^type\s/.test(each))
    .map((each) => {
      const alias = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(each)
      return alias ? alias[1]! : each
    })
}

/** 块注释整段去掉；行注释只认行首或空白后的 //，字符串里的 https:// 不动 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}
