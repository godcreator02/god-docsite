#!/usr/bin/env node
/**
 * 把一个协作仓从旧形态（site/pages/、collab/people.json、collab/ 里的评论记录）迁到新形态（文档站基础包上的站点）。
 * 用法：node scripts/migrate-site.mjs <协作仓的仓根>
 * 只改工作区的文件，不提交；改完列出要接着改的地方（页面里用了旧版网站包的组件）。repo: 链接原样留着，新站照样认。
 * 站点骨架不在这里写，迁完在 gwb 里运行 collab.site.init。
 * 页面地址不变：pages/<id>/page.* 迁成 content/<id>.*，同一页面文件夹里的别的文件放进 content/<id>/；
 * 页面文件夹里还有 .md 笔记的，页面放成 content/<id>/index.*，笔记成了它下面的子页面
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const repo = process.argv[2]
if (!repo || process.argv.length !== 3) throw new Error('用法：node scripts/migrate-site.mjs <协作仓的仓根>')
const siteDir = path.join(repo, 'site')
const pagesDir = path.join(siteDir, 'pages')
const collabDir = path.join(repo, 'collab')
if (!existsSync(pagesDir)) throw new Error(`${pagesDir} 不存在：不是旧形态的协作仓`)

/** 要人手改的地方，最后一起列出 */
const manualFixes = []

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const writeText = (file, text) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}
const posix = (file) => file.split(path.sep).join('/')

// ---------- 读旧的页面目录 ----------

const pageFilePattern = /^page\.(mdx|tsx)$/
const isPageFolder = (dir) => readdirSync(dir).some((name) => pageFilePattern.test(name))

/** pages/ 下全部页面文件夹的 id（相对 pages/ 的路径），日志页 calendar/ 除外 */
function pageIdsUnder(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const id = prefix ? `${prefix}/${entry.name}` : entry.name
      if (id === 'calendar') return []
      const full = path.join(dir, entry.name)
      return isPageFolder(full) ? [id] : pageIdsUnder(full, id)
    })
}
const pageIds = pageIdsUnder(pagesDir)

const metaTitlePattern = /^export const meta = \{\s*title:\s*(['"])(.*?)\1\s*\}\s*;?\s*$/m

function pageFileOf(id) {
  const name = readdirSync(path.join(pagesDir, id)).find((file) => pageFilePattern.test(file))
  return path.join(pagesDir, id, name)
}

const titleOfPage = new Map(
  pageIds.map((id) => {
    const match = metaTitlePattern.exec(readFileSync(pageFileOf(id), 'utf8'))
    if (!match) throw new Error(`${posix(path.relative(repo, pageFileOf(id)))} 里找不到 export const meta = { title: '…' }`)
    return [id, match[2]]
  }),
)

// ---------- 读旧的记录 ----------

const recordsDir = path.join(collabDir, 'records')
const records = readdirSync(recordsDir).map((name) => ({ file: path.join(recordsDir, name), record: readJson(path.join(recordsDir, name)) }))
const recordById = new Map(records.map((entry) => [entry.record.id, entry.record]))
const oldPeople = readJson(path.join(collabDir, 'people.json'))

/** 记录 id 开头 14 位是本地时间，按东八区写成 ISO 时间 */
function timeOfRecordId(id) {
  const d = id.slice(0, 14)
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(8, 10)}:${d.slice(10, 12)}:${d.slice(12, 14)}+08:00`
}

/** 回复所在的那条评论 */
function rootCommentOf(record) {
  let current = record
  while (current.type === 'reply') current = recordById.get(current.target)
  return current
}

const threadIdOfComment = (comment) => `${comment.id.slice(0, 4)}-${comment.id.slice(4, 6)}-${comment.id.slice(6, 8)}-${comment.id.slice(15)}`

/** 评论串挂在哪一页：旧的页面 id 还是一页就挂在那一页；挂在任务页、评论页、日志页的不挂页面 */
function newPageOfComment(comment) {
  if (comment.page === undefined) return undefined
  return titleOfPage.has(comment.page) ? `/${comment.page}` : undefined
}

// ---------- 正文里的写法 ----------

/** <PageLink id="…" /> 换成普通链接，链接文字是那一页现在的标题 */
function replacePageLinks(text, where) {
  return text.replace(/<PageLink\s+id=(["'])([^"'\n]+)\1\s*\/>/g, (_match, _quote, id) => {
    const title = titleOfPage.get(id)
    if (title === undefined) throw new Error(`${where} 里的 <PageLink id="${id}" /> 指向的页面不存在`)
    return `[${title}](/${id})`
  })
}

/** <RecordLink id="…" /> 指向评论或回复的，换成指向那串评论的链接；指向任务、模块的照旧 */
function replaceCommentRecordLinks(text) {
  return text.replace(/<RecordLink\s+id=(["'])([^"'\n]+)\1\s*\/>/g, (match, _quote, id) => {
    const record = recordById.get(id)
    if (!record || (record.type !== 'comment' && record.type !== 'reply')) return match
    const comment = rootCommentOf(record)
    const thread = threadIdOfComment(comment)
    const label = comment.title ?? comment.text.split('\n')[0]
    return `[${label}](${newPageOfComment(comment) ?? '/comments'}?comment=${thread})`
  })
}

/** 旧版网站包的颜色类换成 fumadocs 的；状态色（open、info、done、danger）功能包照旧提供 */
const colorClassOf = {
  'bg-bg': 'bg-fd-background',
  'bg-panel': 'bg-fd-card',
  'bg-subtle': 'bg-fd-muted',
  'bg-hover': 'bg-fd-accent',
  'bg-active': 'bg-fd-accent',
  'border-line': 'border-fd-border',
  'text-fg': 'text-fd-foreground',
  'text-muted': 'text-fd-muted-foreground',
  'text-faint': 'text-fd-muted-foreground/70',
  'text-accent': 'text-fd-primary',
  'bg-accent-soft': 'bg-fd-primary/10',
}
const colorClassPattern = new RegExp(`(?<=[\\s"'\`:])(${Object.keys(colorClassOf).join('|')})(?=[\\s"'\`/]|$)`, 'gm')
const withFumadocsColors = (text) => text.replace(colorClassPattern, (name) => colorClassOf[name])

function noteManualFixes(file, text) {
  if (text.includes('@godcreator/collab-site/page-components')) manualFixes.push(`${file}：用了旧版网站包的 page-components，换成页面自己的组件`)
  if (file.endsWith('.page.tsx') && /<h1[\s>]|<PageHeader[\s>]/.test(text)) manualFixes.push(`${file}：页面自己画了大标题，站点已经按 meta.title 显示标题，去掉页面里的那个`)}

// ---------- 页面 ----------

const contentDir = path.join(siteDir, 'content')
const isNote = (name) => /\.mdx?$/.test(name) && !pageFilePattern.test(name)

/** .md 笔记成了子页面：第一行的 # 标题写进 frontmatter */
function noteAsPage(text, where) {
  const match = /^#\s+(.+)\r?\n/.exec(text)
  if (!match) throw new Error(`${where} 第一行要是「# 标题」，才能当成子页面`)
  return `---\ntitle: ${JSON.stringify(match[1].trim())}\n---\n${text.slice(match[0].length)}`
}

function migratePage(id) {
  const folder = path.join(pagesDir, id)
  const pageFile = pageFileOf(id)
  const extension = path.extname(pageFile)
  const companions = readdirSync(folder).filter((name) => name !== path.basename(pageFile))
  const asFolder = companions.some(isNote)
  const name = path.posix.basename(id)
  const pageTarget = asFolder ? path.join(contentDir, id, extension === '.mdx' ? 'index.mdx' : 'index.page.tsx') : path.join(contentDir, `${id}${extension === '.mdx' ? '.mdx' : '.page.tsx'}`)
  const companionDir = path.join(contentDir, id)
  const where = posix(path.relative(repo, pageFile))
  let text = readFileSync(pageFile, 'utf8')
  if (!asFolder && companions.length > 0) {
    // 同一页面文件夹里的文件挪进 content/<id>/，页面里的 ./ 引用跟着改
    text = text.replace(/(from\s+|import\(\s*|\]\()(['"]?)\.\//g, (_match, before, quote) => `${before}${quote}./${name}/`)
  }
  text = withFumadocsColors(text)
  if (extension === '.mdx') {
    const title = titleOfPage.get(id)
    text = text.replace(metaTitlePattern, '').replace(/^\s+/, '')
    text = `---\ntitle: ${JSON.stringify(title)}\n---\n\n${replaceCommentRecordLinks(replacePageLinks(text, where))}`
  }
  writeText(pageTarget, text)
  noteManualFixes(posix(path.relative(repo, pageTarget)), text)
  for (const companion of companions) {
    const from = path.join(folder, companion)
    const to = path.join(companionDir, companion)
    if (statSync(from).isDirectory()) cpSync(from, to, { recursive: true })
    else if (isNote(companion)) writeText(to, noteAsPage(readFileSync(from, 'utf8'), posix(path.relative(repo, from))))
    else {
      const companionText = readFileSync(from)
      writeText(to, /\.(tsx?|mjs|js)$/.test(companion) ? withFumadocsColors(companionText.toString('utf8')) : companionText)
    }
    if (/\.(tsx?|mdx)$/.test(companion)) noteManualFixes(posix(path.relative(repo, to)), readFileSync(to, 'utf8'))
  }
}

// ---------- 分组：_folder.json → meta.json ----------

const lucideIconOf = {
  folder: 'Folder',
  compass: 'Compass',
  ruler: 'Ruler',
  chip: 'Cpu',
  gridChip: 'Grid3x3',
  search: 'Search',
  archive: 'Archive',
  flask: 'FlaskConical',
  calendar: 'Calendar',
  layers: 'Layers',
  wave: 'AudioWaveform',
  code: 'Code',
  blocks: 'Blocks',
  book: 'Book',
}

function migrateFolders(dir, prefix, depth) {
  const folder = readJson(path.join(dir, '_folder.json'))
  const order = folder.order.filter((name) => !(depth === 0 && name === 'calendar'))
  const meta = { title: folder.title }
  if (depth === 1) {
    const icon = lucideIconOf[folder.icon]
    if (!icon) throw new Error(`${posix(path.relative(repo, dir))}/_folder.json 的 icon ${folder.icon} 没有对应的 lucide 图标`)
    Object.assign(meta, { icon, root: true })
  }
  meta.pages = order
  writeText(path.join(contentDir, prefix, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  for (const name of order) {
    const child = path.join(dir, name)
    if (!isPageFolder(child)) migrateFolders(child, prefix ? `${prefix}/${name}` : name, depth + 1)
  }
}

// ---------- 日志 ----------

function migrateJournal() {
  const calendarDir = path.join(pagesDir, 'calendar')
  if (!existsSync(calendarDir)) return
  for (const date of readdirSync(calendarDir)) {
    const folder = path.join(calendarDir, date)
    const files = readdirSync(folder)
    if (files.length !== 1 || files[0] !== 'page.mdx') throw new Error(`${posix(path.relative(repo, folder))} 里除了 page.mdx 还有别的文件，日志页迁不了`)
    const where = posix(path.relative(repo, path.join(folder, 'page.mdx')))
    const text = replaceCommentRecordLinks(replacePageLinks(readFileSync(path.join(folder, 'page.mdx'), 'utf8'), where))
    const target = path.join(siteDir, 'journal', `${date}.mdx`)
    writeText(target, text)
    noteManualFixes(posix(path.relative(repo, target)), text)
  }
}

// ---------- 评论 ----------

/** 正文里的 @显示名 换成 @id：评论按 @<id> 找提到的人 */
function mentionsAsIds(text, mentions = []) {
  let result = text
  for (const id of mentions) {
    const person = oldPeople.find((entry) => entry.id === id)
    if (person && person.name !== id) result = result.replaceAll(`@${person.name}`, `@${id}`)
  }
  return result
}

const yamlLine = (key, value) => `${key}: ${JSON.stringify(value)}`

function migrateComments() {
  const comments = records.filter(({ record }) => record.type === 'comment').map(({ record }) => record)
  for (const comment of comments) {
    const thread = threadIdOfComment(comment)
    const page = newPageOfComment(comment)
    const notes = []
    if (comment.page !== undefined && page === undefined) notes.push(`（原来批在 ${comment.page} 上）`)
    if (comment.anchor?.quote) notes.push(`> ${comment.anchor.quote}`)
    const head = [yamlLine('author', comment.author), yamlLine('createdAt', timeOfRecordId(comment.id))]
    if (page) head.push(yamlLine('page', page))
    head.push(yamlLine('status', comment.status))
    const body = [comment.title ? `**${comment.title}**` : null, ...notes, mentionsAsIds(comment.text, comment.mentions)].filter(Boolean).join('\n\n')
    writeText(path.join(siteDir, 'comments', thread, 'index.mdx'), `---\n${head.join('\n')}\n---\n\n${body}\n`)
    const replies = records.filter(({ record }) => record.type === 'reply' && rootCommentOf(record).id === comment.id).map(({ record }) => record)
    for (const reply of replies) {
      const replyHead = [yamlLine('author', reply.author), yamlLine('createdAt', timeOfRecordId(reply.id))]
      writeText(path.join(siteDir, 'comments', thread, `${reply.id}.mdx`), `---\n${replyHead.join('\n')}\n---\n\n${mentionsAsIds(reply.text, reply.mentions)}\n`)
    }
  }
  for (const { file, record } of records) if (record.type === 'comment' || record.type === 'reply') rmSync(file)
}

// ---------- 任务的 page、人员列表 ----------

function migrateTaskPages() {
  for (const { file, record } of records) {
    if (record.type !== 'task' || record.page === undefined) continue
    if (!titleOfPage.has(record.page)) throw new Error(`${posix(path.relative(repo, file))} 链接的页面 ${record.page} 不存在`)
    record.page = `/${record.page}`
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
  }
}

function migratePeople() {
  const people = oldPeople.map(({ id, name }) => ({ id, name, gitea: id }))
  writeText(path.join(siteDir, 'people.json'), `[\n${people.map((person) => `  ${JSON.stringify(person)}`).join(',\n')}\n]\n`)
  rmSync(path.join(collabDir, 'people.json'))
}

// ---------- 骨架 ----------

/** 旧版网站包与它带的几项以外，项目自己加的库照旧留着 */
const oldFrameworkDependencies = ['@godcreator/collab-site', 'react', 'react-dom', 'vite', 'typescript', '@types/react', '@types/react-dom']

/**
 * 骨架不在这里写：package.json 只留端口、项目自己加的库和 docsite.features，删掉旧版网站包的骨架文件，
 * 之后由 gwb-collab 的 collab.site.init 照装好的基础包与功能包的模板写 app/ 与配置、装依赖
 */
function migrateSkeleton() {
  const oldPackage = readJson(path.join(siteDir, 'package.json'))
  const port = /--port\s+(\d+)/.exec(oldPackage.scripts.dev)?.[1]
  if (!port) throw new Error(`site/package.json 的 dev 里没有 --port：${oldPackage.scripts.dev}`)
  const keep = (section) => Object.fromEntries(Object.entries(oldPackage[section] ?? {}).filter(([name]) => !oldFrameworkDependencies.includes(name)))
  const next = {
    name: oldPackage.name,
    private: true,
    type: 'module',
    scripts: { dev: `react-router dev --port ${port} --host 127.0.0.1 --strictPort` },
    dependencies: keep('dependencies'),
    devDependencies: keep('devDependencies'),
    docsite: { features: ['@godcreator/collab-site'] },
  }
  for (const file of ['index.html', 'vite.config.ts', 'tsconfig.json', 'pnpm-lock.yaml']) rmSync(path.join(siteDir, file), { force: true })
  writeText(path.join(siteDir, 'package.json'), `${JSON.stringify(next, null, 2)}\n`)
}

// ---------- 执行 ----------

if (existsSync(path.join(siteDir, 'shared'))) throw new Error('site/shared/ 还没想好怎么迁：先把里面的组件复制进用到它的页面文件夹')
for (const id of pageIds) migratePage(id)
migrateFolders(pagesDir, '', 0)
migrateJournal()
migrateComments()
migrateTaskPages()
migratePeople()
migrateSkeleton()
rmSync(pagesDir, { recursive: true })

console.log(`迁好了 ${pageIds.length} 页、${records.filter(({ record }) => record.type === 'comment').length} 串评论；接着在 gwb 里运行 collab.site.init {"repo":"${posix(repo)}"} 写骨架、装依赖`)
if (manualFixes.length > 0) console.log(`要接着改：\n${manualFixes.map((line) => `- ${line}`).join('\n')}`)
