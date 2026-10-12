import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { FileCode2, TriangleAlert } from 'lucide-react'
import { linkChipClassName, linkChipIconClassName } from '@godcreator/docsite-kit/ui'
import { repoLinkPrefix, repoLinksApiUrl, type RepoLinkCheck } from '../repo-link-api.js'

async function postRepoLinks<Result>(body: unknown): Promise<Result> {
  const response = await fetch(repoLinksApiUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const text = await response.text()
  if (!response.ok) throw new Error(response.headers.get('content-type')?.includes('application/json') ? (JSON.parse(text) as { error: string }).error : text)
  return JSON.parse(text) as Result
}

/** 一页里的 repo: 链接攒到同一轮里一起检查；检查结果留到整页刷新 */
const checksByTarget = new Map<string, Promise<RepoLinkCheck>>()
let waitingTargets: Array<{ target: string; resolve: (check: RepoLinkCheck) => void; reject: (error: Error) => void }> = []

function sendWaitingChecks() {
  const batch = waitingTargets
  waitingTargets = []
  postRepoLinks<RepoLinkCheck[]>({ op: 'check', targets: batch.map(({ target }) => target) }).then(
    (checks) => batch.forEach(({ resolve }, index) => resolve(checks[index]!)),
    (error: Error) => batch.forEach(({ reject }) => reject(error)),
  )
}

function checkOf(target: string) {
  let check = checksByTarget.get(target)
  if (!check) {
    check = new Promise<RepoLinkCheck>((resolve, reject) => {
      if (waitingTargets.length === 0) queueMicrotask(sendWaitingChecks)
      waitingTargets.push({ target, resolve, reject })
    })
    checksByTarget.set(target, check)
  }
  return check
}

type ChipState = { kind: 'checking' } | { kind: 'checked'; check: RepoLinkCheck } | { kind: 'failed'; message: string }

const mutedChipClassName = `${linkChipClassName} border-dashed border-fd-border text-fd-muted-foreground`
const brokenChipClassName = `${linkChipClassName} border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400`
const plainChipClassName = `${linkChipClassName} border-fd-border bg-fd-muted/60 text-fd-foreground`

function classNameOf(state: ChipState) {
  if (state.kind === 'failed') return brokenChipClassName
  if (state.kind === 'checking') return plainChipClassName
  const { check } = state
  if (check.state === 'ok') return plainChipClassName
  return check.state === 'no-repo' || check.state === 'read-only' ? mutedChipClassName : brokenChipClassName
}

/**
 * 正文里的 repo:<仓>/<路径> 链接：问站点服务能不能打开，点了按它说的打开——PDF、图片在浏览器的新标签页里，
 * 文本文件在 VS Code 里（带 #L 跳到那一行），别的用系统默认程序。本机没克隆那个仓、只读的站点显示成灰色，文件不在、写错了显示成红色，原因写在 title 里
 */
export function RepoLinkChip({ href, children }: { href: string; children?: ReactNode }) {
  const [state, setState] = useState<ChipState>({ kind: 'checking' })
  const [openProblem, setOpenProblem] = useState<string>()
  useEffect(() => {
    let active = true
    checkOf(href).then(
      (check) => active && setState({ kind: 'checked', check }),
      (error: Error) => active && setState({ kind: 'failed', message: `检查链接失败：${error.message}` }),
    )
    return () => {
      active = false
    }
  }, [href])
  const problem = openProblem ?? (state.kind === 'failed' ? state.message : state.kind === 'checked' && state.check.state !== 'ok' ? state.check.problem : undefined)
  const onClick = (event: MouseEvent) => {
    event.preventDefault()
    if (state.kind !== 'checked' || state.check.state !== 'ok') return
    const { open } = state.check
    if (open.how === 'browser') {
      window.open(open.url, '_blank', 'noopener')
      return
    }
    postRepoLinks({ op: 'open', target: href }).then(
      () => setOpenProblem(undefined),
      (error: Error) => setOpenProblem(`打开失败：${error.message}`),
    )
  }
  const hasWrittenText = !(children === undefined || children === null || (Array.isArray(children) && children.length === 0))
  const Icon = problem === undefined ? FileCode2 : TriangleAlert
  return (
    <a href={href} onClick={onClick} title={problem ?? href} data-repo-link={state.kind === 'checked' ? state.check.state : state.kind} className={openProblem ? brokenChipClassName : classNameOf(state)}>
      <Icon className={linkChipIconClassName} />
      {hasWrittenText ? children : href.slice(repoLinkPrefix.length)}
    </a>
  )
}
