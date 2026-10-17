const [siteServerModule, siteDir, reportId] = process.argv.slice(2)
const { reportAssetLoader, reportPageLoader } = await import(siteServerModule)
const site = { siteDir, siteName: '', hrefBase: '/reports', pageComments: () => ({ threads: [], access: { kind: 'readonly', reasonCode: 'no-identity', reasonText: '' } }) }
const ms = (t) => Math.round(performance.now() - t)

let t = performance.now()
const { report } = await reportPageLoader({ params: { report: reportId } }, site)
console.log(`报告页 loader 第一次：${ms(t)} ms`)
t = performance.now()
await reportPageLoader({ params: { report: reportId } }, site)
console.log(`报告页 loader 第二次：${ms(t)} ms`)

const paths = Object.keys(report.assets)
t = performance.now()
const responses = await Promise.all(paths.map(async (compiled) => {
  const response = await reportAssetLoader({ params: { report: reportId, '*': compiled.slice('assets/'.length) } }, site)
  await response.arrayBuffer()
  return response.status
}))
console.log(`${paths.length} 张图同时请求：${ms(t)} ms，状态 ${[...new Set(responses)].join(',')}`)
