import path from 'node:path'
import { parse as parseYaml } from 'yaml'

/** 外部 mdx 的图放在哪、地址怎么换：相对地址按 mdx 文件所在目录解析，越出 rootDir 就编译不过 */
export interface ExternalAssetPlace {
  /** 正文里的图只能放在这个目录里 */
  rootDir: string
  /** 图在 rootDir 里的相对路径（正斜杠）换成浏览器取它的地址，即功能包的文件路由 */
  assetsHrefOf(relativePath: string): string
}

/** 编译中的文件只用到它的 fail：报错带上节点位置，编译器的原话里就有行列号 */
type FailingFile = { fail(reason: string, place: MdastNode): never }

type JsxAttribute = { type: string; name?: string; value?: unknown }
type EsmStatement = { type: string; source?: unknown }
type MdastNode = { type: string; url?: string; attributes?: JsxAttribute[]; children?: MdastNode[]; data?: { estree?: { body: EsmStatement[] } } }

/** 带协议（http:、data: …）、以 / 或 # 开头的地址不是相对路径，原样保留 */
function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('/') || url.startsWith('#')
}

/** 从别的文件引东西的语句：import 与 export … from。外部页不在 Vite 的构建里，没有东西打包被引用的文件 */
function importsFrom(node: MdastNode): boolean {
  return (node.data?.estree?.body ?? []).some((statement) => statement.type === 'ImportDeclaration' || (statement.source !== undefined && statement.source !== null))
}

/**
 * remark 插件：Markdown 图片的 url 与 JSX 元素上写成字符串的 src，相对 mdx 文件的路径换成 assetsHrefOf 给的地址；
 * 写了 import 编译不过（function-body 格式里它要到运行时才报错）
 */
export function remarkExternalPageRules(file: string, { rootDir, assetsHrefOf }: ExternalAssetPlace) {
  const servedUrlOf = (url: string, node: MdastNode, vfile: FailingFile): string => {
    if (isAbsoluteUrl(url)) return url
    const relative = path.relative(rootDir, path.resolve(path.dirname(file), decodeURI(url))).replaceAll('\\', '/')
    if (relative === '' || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) vfile.fail(`图片地址 ${url} 越出了 ${rootDir}：图只能放在这个目录里`, node)
    return assetsHrefOf(relative)
  }
  const visit = (node: MdastNode, vfile: FailingFile) => {
    if (node.type === 'image' && typeof node.url === 'string') node.url = servedUrlOf(node.url, node, vfile)
    if (node.type === 'mdxjsEsm' && importsFrom(node)) vfile.fail('外部页不能写 import：它不在站点的构建里，没有东西打包被引用的文件；要共用的组件放进功能包或平台的组件表', node)
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      for (const attribute of node.attributes ?? []) {
        if (attribute.type === 'mdxJsxAttribute' && attribute.name === 'src' && typeof attribute.value === 'string') attribute.value = servedUrlOf(attribute.value, node, vfile)
      }
    }
    for (const child of node.children ?? []) visit(child, vfile)
  }
  return () => (tree: MdastNode, vfile: FailingFile) => visit(tree, vfile)
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

/** 拆出 frontmatter；正文前面补同样行数的空行，编译器报的行号仍对得上原文件。frontmatter 不是合法的 YAML 映射回 message */
export function externalMdxSourceOf(source: string): { frontmatter: Record<string, unknown>; body: string } | { message: string } {
  const match = frontmatterPattern.exec(source)
  if (match === null) return { frontmatter: {}, body: source }
  let data: unknown
  try {
    data = parseYaml(match[1]!)
  } catch (error) {
    return { message: `frontmatter 不是合法的 YAML：${error instanceof Error ? error.message : String(error)}` }
  }
  if (data !== null && (typeof data !== 'object' || Array.isArray(data))) return { message: `frontmatter 要写成「键: 值」的映射，收到 ${JSON.stringify(data)}` }
  return { frontmatter: (data ?? {}) as Record<string, unknown>, body: match[0].replace(/[^\n]/g, '') + source.slice(match[0].length) }
}