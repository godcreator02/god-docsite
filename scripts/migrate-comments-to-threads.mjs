// 一次性迁移：把旧机制评论（目录名 2026-10-10-xxx，frontmatter 带 quote/range 的文字锚点）转成
// 新机制评论串（目录名符合 COMMENT_ID_PATTERN，frontmatter page/author/createdAt）。
// 文字锚点（quote/range/openers/snapshot.txt）没有新机制对应物，丢弃——文字级定位是待拆借能力；
// 同目录的 tsx/图片附件原样带进新串文件夹。用法：node scripts/migrate-comments-to-threads.mjs <站点目录>
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const siteDir = process.argv[2]
if (!siteDir) throw new Error('用法：node scripts/migrate-comments-to-threads.mjs <站点目录>')
const commentsDir = path.join(siteDir, 'comments')

/** 轻量解析这个项目用到的 YAML frontmatter（字符串值），数组值（quote/range 等）直接返回原文（迁移不用它们） */
function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) throw new Error('没有 frontmatter')
  const fields = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(': ')
    if (colon <= 0) continue
    const key = line.slice(0, colon)
    let value = line.slice(colon + 2)
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    fields[key] = value
  }
  return { fields, body: text.slice(match[0].length) }
}

const pad = (n, w = 2) => String(n).padStart(w, '0')
const idOf = (date, used) => {
  const stamp = `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1)}${pad(date.getDate())}t${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  let suffix = Math.random().toString(36).slice(2, 6)
  while (used.has(`${stamp}-${suffix}`)) suffix = Math.random().toString(36).slice(2, 6)
  used.add(`${stamp}-${suffix}`)
  return `${stamp}-${suffix}`
}

/** 旧 page 是页面 URL（"/writing/collapse-test"）；新键是 docs 集合内路径（"writing/collapse-test.mdx"） */
/** 没有 page 的旧评论（站级/不挂页面的评论，新机制还没有这个功能）：挂到保留键，数据不丢、不显示 */
function pageKeyOf(url) {
  if (url === undefined || url === '') return '_site.mdx'
  if (url === '/') return 'index.mdx'
  return `${url.replace(/^\//, '')}.mdx`
}

const used = new Set()
const migrated = []
for (const entry of await readdir(commentsDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || /^\d{8}t\d{6}-[0-9a-z]{2,8}$/.test(entry.name)) continue
  const oldDir = path.join(commentsDir, entry.name)
  const files = await readdir(oldDir)
  const headText = await readFile(path.join(oldDir, 'index.mdx'), 'utf-8')
  const { fields: head, body } = parseFrontmatter(headText)
  const date = new Date(head.createdAt)
  if (Number.isNaN(date.getTime())) throw new Error(`${entry.name}/index.mdx 的 createdAt 不是时间：${head.createdAt}`)
  const threadId = idOf(date, used)
  const newDir = path.join(commentsDir, threadId)
  await mkdir(newDir)
  const serialize = (extra) => `---\n${Object.entries(extra).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n${body.trimEnd()}\n`
  await writeFile(path.join(newDir, 'index.mdx'), serialize({ page: pageKeyOf(head.page), author: head.author, createdAt: head.createdAt }), 'utf-8')
  const attachments = []
  for (const file of files) {
    if (file === 'index.mdx' || file === 'snapshot.txt') continue
    const text = await readFile(path.join(oldDir, file), 'utf-8').catch(() => null)
    if (file.endsWith('.mdx') && text !== null) {
      const { fields: reply, body: replyBody } = parseFrontmatter(text)
      const replyDate = new Date(reply.createdAt)
      const replyId = idOf(Number.isNaN(replyDate.getTime()) ? date : replyDate, used)
      await writeFile(
        path.join(newDir, `${replyId}.mdx`),
        `---\nauthor: ${JSON.stringify(reply.author)}\ncreatedAt: ${JSON.stringify(reply.createdAt)}\n---\n\n${replyBody.trimEnd()}\n`,
        'utf-8',
      )
      attachments.push(`${file} → ${replyId}.mdx（回复）`)
    } else {
      const { copyFile } = await import('node:fs/promises')
      await copyFile(path.join(oldDir, file), path.join(newDir, file))
      attachments.push(`${file}（附件）`)
    }
  }
  await rm(oldDir, { recursive: true, force: true })
  migrated.push(`${entry.name} → ${threadId}（page ${pageKeyOf(head.page)}，author ${head.author}）${attachments.length > 0 ? `；${attachments.join('、')}` : ''}`)
}
console.log(`迁移了 ${migrated.length} 串：`)
for (const line of migrated) console.log(`  ${line}`)
