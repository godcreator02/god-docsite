'use client';
/**
 * 首页「一眼看懂钉码」：文档里一句话钉住 greet.ts 两行，选一种代码变化，看那句话旁边的点、源码和 check 的输出怎么变。
 * 数据与讲解文字都在 glance.data.mjs；情况按钮与说明由 CasePicker 显示。机读版由 glance.ai.mjs 读同一份数据生成。
 */
import { CasePicker, CodeLines, Dot, Pane, Pill, Terminal } from '@godcreator/explainer-player';
import { toneOfStatus } from '../pin/tone';
import { cases, files, marker, statusName } from './glance.data.mjs';

type GlanceCase = (typeof cases)[number];

function Picture({ item }: { item: GlanceCase }) {
  const tone = toneOfStatus[item.status];
  return (
    <>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <Pane title={files.doc} role="blue" icon="file" extra="文档">
          <span>greet 返回一句问候：</span>
          <div className="pin-marker">
            <Dot tone={tone} />
            <span>{marker}</span>
          </div>
        </Pane>
        <Pane title={files.ref} role="violet" icon="file" extra="源码">
          <CodeLines lines={item.code} highlight={item.span} tone={tone} added={item.added} changed={item.changed} />
        </Pane>
      </div>
      <Pill key={item.id} tone={tone} dot>
        {statusName[item.status]}
      </Pill>
      <Terminal
        title="~/repo/docs-site"
        lines={[
          { text: 'pnpm docfirst check', kind: 'cmd' },
          { text: item.cli, kind: item.status === 'missing' ? 'err' : item.status === 'fresh' ? 'ok' : 'out' },
        ]}
      />
    </>
  );
}

export function PinGlance() {
  return (
    <div className="not-prose">
      <CasePicker cases={cases} label="代码发生了什么">
        {(item) => <Picture item={item} />}
      </CasePicker>
    </div>
  );
}
