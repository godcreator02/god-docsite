'use client';
/**
 * DocExportSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写。
 * 走线原则：线不沿模块的虚线框边走（离框边至少 12px），编号圆点不落在别的线上，几条线挤在一处时绕开。
 * 上排 docfirst，左列站目录（框外），中列 doc-export 的六个能力竖排，右列 code-pin 与生成物（框外）。
 * 左走廊（x 288 / 316 / 344）走 6、3、1 号；右走廊（x 672 / 688 / 704）走 5、4、2 号；
 * 1 号从读配置下来分两支进落点表与名册的左边，2 号从三条命令绕到写出与核对的右边。
 */
import { FileOutput, FileText, FolderOpen, Pin, Terminal } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { docExportSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1120, h: 648 },
  caps: {
    // 上排：docfirst 的两个能力横排
    'config-load': cap(326, 56, 196),
    commands: cap(538, 56, 216),
    // 左列：站目录的三个能力竖排
    config: cap(36, 210, 218),
    'ai-rules': cap(36, 282, 218),
    sources: cap(36, 354, 218),
    // 中列：doc-export 的六个能力竖排
    placements: cap(376, 210, 268),
    render: cap(376, 278, 268),
    frontmatter: cap(376, 346, 268),
    roster: cap(376, 414, 268),
    write: cap(376, 482, 268),
    turf: cap(376, 550, 268),
    // 右列上：code-pin；右列下：生成物
    'pin-swap': cap(732, 210, 298),
    'artifact-files': cap(732, 362, 298),
  },
  groups: {
    docfirst: { x: 310, y: 16, w: 460, h: 108 },
    site: { x: 20, y: 170, w: 250, h: 300 },
    'doc-export': { x: 360, y: 170, w: 300, h: 446 },
    'code-pin': { x: 716, y: 170, w: 330, h: 108 },
    artifacts: { x: 716, y: 322, w: 330, h: 100 },
  },
  seamPaths: {
    // 读配置 → 落点表与名册：从 config-load 底部下到两框之间的走廊 x=344，两支分别进 placements 与 roster 的左边
    '1': { d: 'M424,104 V146 H344 V426 M344,234 H376 M344,426 H376', badge: [380, 146] },
    // 三条命令 → 写出与核对：从 commands 底部走右缘走廊 x=704 下来，绕到 write 右边进
    '2': { d: 'M646,104 V158 H704 V526 H644', badge: [704, 300] },
    // 写出与核对 ⇠ 正本：从 write 左边走左走廊 x=316 上去，进 sources 右边
    '3': { d: 'M376,506 H316 V378 H254', badge: [316, 478] },
    // 写出与核对 ⇢ 生成物：从 write 右边走右走廊 x=688 上去，进落点文件左边
    '4': { d: 'M644,502 H688 V384 H732', badge: [688, 440] },
    // 渲染管线 → code-pin：从 render 右边走右走廊 x=672，进标记换成代码块左边
    '5': { d: 'M644,302 H672 V250 H732', badge: [672, 276] },
    // 名册 ⇠ 机读规则：从 roster 左边走左走廊 x=288 上去，进 ai-rules 右边
    '6': { d: 'M376,450 H288 V306 H254', badge: [288, 326] },
  },
  entries: {},
  moduleIcons: {
    site: FolderOpen,
    docfirst: Terminal,
    'doc-export': FileOutput,
    'code-pin': Pin,
    artifacts: FileText,
  },
  entryIcons: {},
};

export function DocExportSeams(): JSX.Element {
  return <SeamDiagram graph={docExportSeams} layout={layout} />;
}
