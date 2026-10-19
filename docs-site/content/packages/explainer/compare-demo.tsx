'use client';
/**
 * 对比表放进动画：每一章讲一行，讲过的行留着、正在讲的那一行描边，还没讲到的行留着位置不显示。
 * 换章时格子的状态才变，播放中每一帧不改字。数据在 compare-demo.data.mjs。
 */
import type { JSX } from 'react';
import { CompareGrid, Timeline, revealByRow } from '@godcreator/explainer/site';
import { chapters, columns, rows } from './compare-demo.data.mjs';

export function CompareDemo(): JSX.Element {
  return (
    <Timeline chapters={chapters} label="对比表放进动画的例子">
      {({ index }) => (
        <CompareGrid columns={columns} rows={rows} cellState={(row) => revealByRow([0, 1, 2, 3], index)(row)} minWidth={520} />
      )}
    </Timeline>
  );
}
