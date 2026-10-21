import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/*
 * e2e 在测试站里新建的东西都带本次运行编号 runTag，跑完按编号删掉：仓里的已跟踪文件一个都不改，
 * 跑完 git status 和跑之前一样（run.mjs 最后一项检查）。别的会话可能同时在改这个仓，回退文件会误伤别人，所以只删自己建的
 */

/** 协作仓布局：站点在仓根的 site/，任务与模块在仓根的 collab/records/ */
export const recordsDirOf = (siteDir) => path.join(path.dirname(siteDir), 'collab', 'records')

/** dev 下「新增内容文件」那一项在检查里新建的页 */
export function addedPageOf(siteDir, runTag) {
  const slug = `e2e-added-${runTag}`
  return { slug, file: path.join(siteDir, 'content', `${slug}.mdx`), text: `---\ntitle: 新增的页 ${runTag}\n---\n\n新增文件的正文。\n` }
}

/** dev 下「改 TSX 页标题」那一项要改的页：起 dev 之前建好，检查里改它的标题 */
export function titlePageOf(siteDir, runTag) {
  const slug = `e2e-title-${runTag}`
  const text = [
    "import { useState } from 'react'",
    '',
    `export const meta = { title: 'TSX 改标题页 ${runTag}', description: 'e2e 改标题用的临时页' }`,
    '',
    'export default function TitleScratchPage() {',
    '  const [count, setCount] = useState(0)',
    '  return (',
    '    <button type="button" data-title-scratch-counter="" onClick={() => setCount(count + 1)}>',
    '      {count}',
    '    </button>',
    '  )',
    '}',
    '',
  ].join('\n')
  return { slug, file: path.join(siteDir, 'content', `${slug}.page.tsx`), text }
}

export function writeTitlePage(siteDir, runTag) {
  const { file, text } = titlePageOf(siteDir, runTag)
  writeFileSync(file, text)
}

/** dev 下「内容目录放错文件」那一项在内容目录根上放的组件文件：组文件夹里只放页面，它是放错的 */
export function strayContentFileOf(siteDir, runTag) {
  const name = `E2eStray${runTag.replace(/[^a-zA-Z0-9]/g, '')}.tsx`
  return { name, file: path.join(siteDir, 'content', name), text: 'export const stray = 1\n' }
}

/** dev 下「自包含检查」那一项在内容目录里放的页：引用了试验论文库里没有的一条 */
export function missingReferencePageOf(siteDir, runTag) {
  const id = `e2e-missing-${runTag}`
  return { id, name: `e2e-missing-ref-${runTag}.mdx`, file: path.join(siteDir, 'content', `e2e-missing-ref-${runTag}.mdx`), text: `---\ntitle: 引用缺项 ${runTag}\n---\n\n<FixturePaper id="${id}" />\n` }
}

/** dev 下「数据目录就地更新」那一项在试验论文库里加的一条 */
export function addedPaperOf(siteDir, runTag) {
  const id = `e2e-${runTag}`
  const dir = path.join(siteDir, 'fixture-papers', id)
  return { id, dir, title: `新加的论文 ${runTag}` }
}

export function writeAddedPaper(siteDir, runTag) {
  const { dir, title } = addedPaperOf(siteDir, runTag)
  mkdirSync(path.join(dir, 'mdx'), { recursive: true })
  writeFileSync(path.join(dir, 'mdx', 'paper.mdx'), `${title} 的正文。\n`)
  writeFileSync(path.join(dir, 'meta.json'), `${JSON.stringify({ title, pages: { paper: '正文' } })}\n`)
}

function removeTempPages(siteDir, runTag) {
  const addedPaper = addedPaperOf(siteDir, runTag).dir
  const removedPaper = existsSync(addedPaper) ? [addedPaper] : []
  if (removedPaper.length > 0) rmSync(addedPaper, { recursive: true })
  return [...removedPaper, ...[addedPageOf(siteDir, runTag).file, titlePageOf(siteDir, runTag).file, strayContentFileOf(siteDir, runTag).file, missingReferencePageOf(siteDir, runTag).file].filter((file) => {
    if (!existsSync(file)) return false
    rmSync(file)
    return true
  })]
}

/** 评论：串头正文带 runTag 的整串删掉；别的串里带 runTag 的回复单独删 */
function removeRunComments(siteDir, runTag) {
  const commentsDir = path.join(siteDir, 'comments')
  const removed = []
  for (const thread of readdirSync(commentsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const threadDir = path.join(commentsDir, thread.name)
    const headFile = path.join(threadDir, 'index.mdx')
    if (existsSync(headFile) && readFileSync(headFile, 'utf8').includes(runTag)) {
      rmSync(threadDir, { recursive: true })
      removed.push(threadDir)
      continue
    }
    for (const reply of readdirSync(threadDir).filter((name) => name !== 'index.mdx')) {
      const replyFile = path.join(threadDir, reply)
      if (!readFileSync(replyFile, 'utf8').includes(runTag)) continue
      rmSync(replyFile)
      removed.push(replyFile)
    }
  }
  return removed
}

/** 任务与模块：标题带 runTag 的记录文件 */
function removeRunRecords(siteDir, runTag) {
  const recordsDir = recordsDirOf(siteDir)
  return readdirSync(recordsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(recordsDir, name))
    .filter((file) => {
      if (!String(JSON.parse(readFileSync(file, 'utf8')).title ?? '').includes(runTag)) return false
      rmSync(file)
      return true
    })
}

/** 删掉本次运行在站点里建的全部东西，返回删了哪些路径 */
export function removeRunLeftovers(siteDir, runTag) {
  return [...removeTempPages(siteDir, runTag), ...removeRunComments(siteDir, runTag), ...removeRunRecords(siteDir, runTag)]
}
