import type { JSX, ReactNode } from 'react'
import { CasePicker, Pane, Pill, Terminal } from '@godcreator/explainer/site'
import type { Role } from '@godcreator/explainer/site'

/** 流程链里的一站：rose 是我们的包 */
interface ChainStop {
  label: string
  note?: string
  role: Role
}

/** 一条竖着的流程链：每站一个胶囊加一句说明，站与站之间一道箭头 */
function Chain({ stops }: { stops: ReadonlyArray<ChainStop> }): JSX.Element {
  return (
    <div className="flex flex-col items-stretch">
      {stops.map((stop, index) => (
        <div key={stop.label} className="flex flex-col">
          {index === 0 ? null : <span aria-hidden="true" className="select-none self-center text-[10px] leading-4 text-zinc-400 dark:text-zinc-600">↓</span>}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-px text-xs">
            <Pill role={stop.role}>{stop.label}</Pill>
            {stop.note ? <span className="text-zinc-500 dark:text-zinc-400">{stop.note}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function Products({ children }: { children: ReactNode }): JSX.Element {
  return <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-zinc-300 pt-2 text-xs dark:border-zinc-700">{children}</div>
}

function SitePath(): JSX.Element {
  return (
    <Pane title="outputs/agents.mdx 里的 <Pin>，走站点的编译链" icon="terminal" role="blue">
      <Chain
        stops={[
          { label: 'fumadocs 默认工序', note: 'gfm、标题 id、图片…', role: 'emerald' },
          { label: 'remarkDocfirst', note: '换成 PinBlock 给网页显示，登记 Markdown 形式', role: 'rose' },
          { label: 'remarkStructure', note: '读登记表，切搜索记录', role: 'emerald' },
          { label: 'remarkLLMs', note: '开了 includeProcessedMarkdown 才运行：读登记表，出整页 Markdown', role: 'emerald' },
        ]}
      />
      <Products>
        <span className="text-zinc-500 dark:text-zinc-400">产物：</span>
        <Pill dot tone="info">搜索索引</Pill>
        <Pill dot tone="info">llms.txt、每页 .md（请求时由路由读出）</Pill>
      </Products>
    </Pane>
  )
}

function CliPath(): JSX.Element {
  return (
    <Pane title="同一个 <Pin>，命令行里生成正本" icon="git" role="amber">
      <Chain
        stops={[
          { label: '解析', note: 'remark-parse + mdx，不启动 Vite', role: 'slate' },
          { label: 'remarkDocfirst', note: '同一个插件，生成正本模式：没确认、缺失都拒绝', role: 'rose' },
          { label: 'remarkLLMs', note: '读登记表出 Markdown（关掉标题 id）', role: 'emerald' },
          { label: '加 frontmatter、写文件', note: 'outputs 里点名的字段（SKILL.md 要 name、description）', role: 'amber' },
        ]}
      />
      <Products>
        <span className="text-zinc-500 dark:text-zinc-400">产物与核对：</span>
        <Pill dot tone="info">AGENTS.md 等落点，随正本同一个提交</Pill>
        <Pill dot tone="good">docfirst check 逐字节比</Pill>
      </Products>
      <Terminal
        title="docsite-kit"
        lines={[
          { text: 'pnpm docfirst render', kind: 'cmd' },
          '写出 AGENTS.md、CLAUDE.md、plugins/docsite/skills/docsite/SKILL.md',
          { text: 'pnpm docfirst check', kind: 'cmd' },
          { text: '一致，绿', kind: 'ok' },
        ]}
      />
    </Pane>
  )
}

/** 同一个正本（outputs/agents.mdx 里的一个 <Pin>）走两条路 */
export function OutputsPaths(): JSX.Element {
  return (
    <CasePicker
      label="同一正本的两条出路"
      cases={[
        {
          id: 'site',
          label: '站点：编译链',
          text: 'dev 与 build 都走这条：Vite 把 .mdx 交给 fumadocs-mdx，钉码插件换成 PinBlock 给网页显示，同时用 replaceSource 登记它的 Markdown 形式。搜索记录、llms.txt、页面上的「复制 Markdown」都从这一条链来——Markdown 形式只写一次，谁要谁读。',
        },
        {
          id: 'cli',
          label: '命令行：生成正本',
          text: 'AGENTS.md、SKILL.md 这些生成物走另一条路：docfirst render 在命令行里读同一个 mdx、跑同一个 remarkDocfirst，只是打开生成正本模式——钉码没确认、钉码缺失都拒绝生成。不放进 build：站点不运行它们也得在，也不能让 build 去改仓里受版本管理的文件。',
        },
      ]}
    >
      {(item) => (item.id === 'site' ? <SitePath /> : <CliPath />)}
    </CasePicker>
  )
}
