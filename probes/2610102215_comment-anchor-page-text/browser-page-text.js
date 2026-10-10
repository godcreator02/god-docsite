// 在开发服务的任意一页打开浏览器控制台，整段粘贴运行：用 iframe 依次打开各页，等浏览器渲染完，
// 按 page-text-rules.ts 的规则走 DOM 算页面文字，打印长度与 sha1，和 server-page-text.mjs 的输出逐行对比
const pages = ['/', '/skeleton', '/comments', '/dev-plugin', '/page-types', '/page-types/tsx-page', '/page-types/html-page', '/writing', '/writing/components', '/zz-anchor-test']
const atomicTags = new Set(['img', 'svg', 'canvas', 'video', 'iframe'])

function pageTextOf(scope) {
  let text = ''
  const walk = (parent) => {
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.data
      else if (child.nodeType === Node.ELEMENT_NODE) {
        const classes = [...child.classList]
        if (child.hasAttribute('data-comment-ui') || classes.includes('sr-only')) continue
        if (atomicTags.has(child.tagName.toLowerCase()) || classes.includes('katex')) text += '￼'
        else walk(child)
      }
    }
  }
  walk(scope)
  return text
}

async function sha1Of(text) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 12)
}

const lines = []
for (const page of pages) {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;left:-3000px;width:1400px;height:900px'
  frame.src = page
  document.body.append(frame)
  await new Promise((resolve) => (frame.onload = resolve))
  // 等浏览器端渲染（如代码块着色）跑完
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const text = pageTextOf(frame.contentDocument.querySelector('[data-comment-scope]'))
  lines.push(JSON.stringify({ page, length: text.length, sha1: await sha1Of(text) }))
  frame.remove()
}
console.log(lines.join('\n'))
