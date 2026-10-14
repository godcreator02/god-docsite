import type { DocsiteContext } from './site-context.js'

/** 启动方可以直接给出可信 origin（如经反向代理访问时），给了就只认它 */
export const siteOriginEnvName = 'DOCSITE_ORIGIN'

/** 命令行里某个选项的值：--port 4000 与 --port=4000 都认；没写是 undefined，写了不带值是 '' */
export function optionValueOf(argv: readonly string[], name: string): string | undefined {
  for (const [index, arg] of argv.entries()) {
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1)
    if (arg !== name) continue
    const next = argv[index + 1]
    return next === undefined || next.startsWith('-') ? '' : next
  }
  return undefined
}

function checkedOrigin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`${siteOriginEnvName} 不是网址：${value}`)
    throw error
  }
  if (url.origin !== value) throw new Error(`${siteOriginEnvName} 只写 origin（协议、主机、端口），不带路径和末尾的斜杠：收到 ${value}，应写 ${url.origin}`)
  return value
}

/** 监听所有网卡或没写主机时，本机打开的地址是 localhost */
function browserHostOf(host: string | undefined): string {
  return host === undefined || host === '' || host === '0.0.0.0' || host === '::' ? 'localhost' : host
}

/**
 * 站点的可信 origin：写入请求的 Origin 头要和它完全一样。规则：
 * - 设了 DOCSITE_ORIGIN 就是它；
 * - dev（react-router dev）：端口取启动参数 --port，主机取 --host（没写或监听全部网卡时是 localhost）；没写 --port 报错，
 *   因为 Vite 会在端口被占时换一个，猜不出来；
 * - start（react-router-serve）：端口取环境变量 PORT，主机取 HOST（没写是 localhost）；没设 PORT 报错，因为它会自己挑空闲端口
 */
export function siteOrigin(mode: DocsiteContext['mode'], { argv = process.argv, env = process.env }: { argv?: readonly string[]; env?: NodeJS.ProcessEnv } = {}): string {
  const configured = env[siteOriginEnvName]
  if (configured !== undefined) return checkedOrigin(configured)
  if (mode === 'dev') {
    const port = optionValueOf(argv, '--port')
    if (port === undefined || port === '') throw new Error(`算不出可信 origin：dev 脚本要写 react-router dev --port <端口>，或者设 ${siteOriginEnvName}`)
    return `http://${browserHostOf(optionValueOf(argv, '--host'))}:${port}`
  }
  const port = env['PORT']
  if (port === undefined || port === '') throw new Error(`算不出可信 origin：react-router-serve 要设环境变量 PORT，或者设 ${siteOriginEnvName}`)
  return `http://${browserHostOf(env['HOST'])}:${port}`
}
