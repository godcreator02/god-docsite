const base = process.argv[2]
const report = process.argv[3]
const ms = (t) => Math.round(performance.now() - t)

let t = performance.now()
const html = await (await fetch(`${base}reports/${report}`)).text()
console.log(`页面 HTML ${html.length} 字节，${ms(t)} ms`)

const urls = [...new Set([...html.matchAll(/\/reports\/[^"'\\\s]+\/assets\/[^"'\\\s]+\.(?:png|jpe?g)/g)].map((m) => m[0]))]
console.log(`图片地址 ${urls.length} 个`)

t = performance.now()
let res = await fetch(base + urls[0].slice(1))
let buf = await res.arrayBuffer()
console.log(`单张（单独请求）${urls[0]}：${res.status}，${buf.byteLength} 字节，${ms(t)} ms，cache-control=${res.headers.get('cache-control')}`)

t = performance.now()
const results = await Promise.all(urls.map(async (u) => {
  const s = performance.now()
  const r = await fetch(base + u.slice(1))
  const b = await r.arrayBuffer()
  return { u, status: r.status, size: b.byteLength, ms: ms(s) }
}))
console.log(`全部并发：${ms(t)} ms`)
results.sort((a, b) => a.ms - b.ms)
for (const r of [results[0], results[Math.floor(results.length / 2)], results.at(-1)]) console.log(`  ${r.ms} ms ${r.status} ${r.size} ${r.u}`)
