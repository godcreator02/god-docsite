'use client';
/**
 * PinKinds：三种目标（行段、整文件、目录树）各记什么、确认前后标记那一行怎么变。
 * 上面一张卡摆钉的是什么（CodeLines 高亮钉住的行），下面一张卡摆标记那一行（Diff：确认前只写目标，确认后带上记录）。
 * 哈希与 blob 名是示意值。数据都在 pin-kinds.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Diff, Pane } from '@godcreator/explainer/site';
import { kinds } from './pin-kinds.data.mjs';
import type { PinKind } from './pin-kinds.data.mjs';
import './pin-kinds.css';

function KindView({ item }: { item: PinKind }): JSX.Element {
  return (
    <div className="pk-kind">
      <Pane title={`钉的是什么：${item.paneTitle}`} icon="file" role="blue">
        <CodeLines lines={item.code} start={item.start} highlight={item.highlight} tone="info" />
      </Pane>
      <Pane title="标记那一行" icon="terminal" role="violet" extra={<span className="pk-flow">确认前 → 确认后</span>}>
        <Diff old={[item.before]} now={[item.after]} />
      </Pane>
      <p className="pk-note">目录树不存旧名字表，变了只知道变了。</p>
    </div>
  );
}

export function PinKinds(): JSX.Element {
  return (
    <CasePicker cases={kinds} label="三种目标各记什么、标记那一行怎么变">
      {(item) => <KindView key={item.id} item={item} />}
    </CasePicker>
  );
}
