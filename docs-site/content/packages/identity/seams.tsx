'use client';
/**
 * IdentitySeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在方块上，
 * 线与模块框边平行时至少留 12px、编号圆点不放在别的线上。
 * 四列：左 gwb-docsite（三个能力）、中左站点目录（框外，people.json 放低）、中 identity 包（七项能力竖排）、右用它的两方。
 * 1 号（join → joinSitePeople）与 4 号（托管方上下文 → siteIdentity）走站点目录上方的空档直达；
 * 2 号（写回名单）沿走廊 x=500 下去、绕到 people.json 底边进，3 号（现读名单）沿 x=482 从右边进，两条虚线各走各的；
 * 6 号（写入前核对）走右列走廊（x=862）；5 号的 site.server.ts 段走走廊 x=846，布局路由段沿右缘（x=1088）绕到下面两个能力。
 */
import { Database, IdCard, Monitor, Plug, Users } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { identitySeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1110, h: 568 },
  caps: {
    // 左列：gwb-docsite 的三个能力竖排
    code: cap(32, 64, 196),
    join: cap(32, 134, 196),
    launch: cap(32, 204, 196),
    // 中左：站点目录里的名单（放低，避开 1、4 号横线）
    'people-file': cap(307, 304, 146),
    // 中列：identity 包的七项能力竖排
    parse: cap(532, 64, 240),
    'join-node': cap(532, 134, 240),
    read: cap(532, 204, 240),
    recognize: cap(532, 274, 240),
    authorize: cap(532, 344, 240),
    public: cap(532, 414, 240),
    ui: cap(532, 484, 284),
    // 右列：平台模板两个能力竖排、comments 与 collab 一个
    'platform-layout': cap(887, 64, 176),
    'platform-server': cap(887, 134, 176),
    writers: cap(887, 274, 176),
  },
  groups: {
    'gwb-docsite': { x: 20, y: 20, w: 220, h: 248 },
    'site-dir': { x: 295, y: 260, w: 170, h: 108 },
    identity: { x: 520, y: 20, w: 300, h: 528 },
    platform: { x: 875, y: 20, w: 200, h: 178 },
    writers: { x: 875, y: 230, w: 200, h: 122 },
  },
  seamPaths: {
    // docsite.people.join → joinSitePeople：从 join 右边直达 join-node 左边中心（与 2 号的出口错开 16px）
    '1': { d: 'M228,158 H532', badge: [380, 158] },
    // joinSitePeople ⇢ people.json（写回）：出 join-node 左边（比 1 号的进口低 16px），沿走廊 x=500 下去，绕到名单底边进
    '2': { d: 'M532,174 H500 V390 H380 V352', badge: [500, 310] },
    // sitePeople ⇠ people.json（现读）：出 read 左边（比 4 号的进口低 16px），沿 x=482 从名单右边进
    '3': { d: 'M532,244 H482 V328 H453', badge: [482, 268] },
    // 启动开发服务 →（托管方上下文）→ siteIdentity：从 launch 右边直达 read 左边
    '4': { d: 'M228,228 H532', badge: [380, 228] },
    // 平台模板 → siteIdentity、publicPeopleOf、界面：site.server.ts 段走走廊 x=846 进 read 右边；
    // 布局路由段从 layout 右边沿右缘 x=1088 绕下来（与两框右缘相距 13px），进 public 与 ui 的右边（ui 比 core 能力宽，右缘 x=816）
    '5': { d: 'M887,158 H846 V228 H772 M1063,88 H1088 V438 H772 M1088,508 H816', badge: [1088, 380] },
    // comments 与 collab 的写入 action → authorizeWrite：走右列走廊 x=862
    '6': { d: 'M887,298 H862 V368 H772', badge: [862, 330] },
  },
  entries: {},
  moduleIcons: {
    'gwb-docsite': Plug,
    'site-dir': Database,
    identity: IdCard,
    platform: Monitor,
    writers: Users,
  },
  entryIcons: {},
};

export function IdentitySeams(): JSX.Element {
  return <SeamDiagram graph={identitySeams} layout={layout} />;
}
