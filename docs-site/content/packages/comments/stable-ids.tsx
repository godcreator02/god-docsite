'use client';
/**
 * StableIds：稳定 id 按内容算，内容不变 id 就不变；同页相同内容按次序加后缀，前面插一份相同内容会让后缀错位（已知边界）。
 * 一列段落卡片，每张右边一个等宽小标签写它分到的 id；与上一情况比变了的 id 用 warn 色，新插进来的段落标「新插入」；
 * 后缀错位的情况在下面挂一个 warn 胶囊「已知边界」。数据都在 stable-ids.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane, Pill } from '@godcreator/explainer/site';
import { cases } from './stable-ids.data.mjs';
import type { IdBlock } from './stable-ids.data.mjs';
import './stable-ids.css';

function BlockCard({ block }: { block: IdBlock }): JSX.Element {
  return (
    <div className="si-block" data-inserted={block.inserted ? '' : undefined}>
      <span className="si-text">{block.text}</span>
      <code className="si-id" data-changed={block.changed ? '' : undefined}>
        {block.id}
      </code>
    </div>
  );
}

export function StableIds(): JSX.Element {
  return (
    <CasePicker cases={cases} label="稳定 id 按内容算：内容不变 id 不变">
      {(item) => (
        <Pane
          title="同一页的候选块"
          icon="file"
          role="blue"
          extra={item.knownEdge ? <Pill tone="warn" dot>已知边界</Pill> : undefined}
        >
          <div className="si-list">
            {item.blocks.map((block) => (
              <BlockCard key={`${block.id}:${block.text}`} block={block} />
            ))}
          </div>
        </Pane>
      )}
    </CasePicker>
  );
}
