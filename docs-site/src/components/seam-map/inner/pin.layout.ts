/**
 * 钉码核心内部接缝图（pin.data.mjs）的坐标与图标。调用方在最上，编排服务、比较器、hunk 与 hash 依次往下，
 * 包外的三样实现在右边一列，node:crypto 在最下。
 */
import { Cog, GitCompare, Hash, Lock, Plug, Scale, SquareTerminal, Tag, Wrench } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const pinLayout: SeamLayout = {
  view: { w: 1100, h: 690 },
  caps: {
    load: cap(34, 52, 210),
    cli: cap(254, 52, 212),
    remark: cap(514, 52, 212),

    resolve: cap(34, 202, 220),
    confirm: cap(264, 202, 220),
    observe: cap(494, 202, 232),

    judge: cap(34, 352, 136),
    snapshot: cap(180, 352, 130),
    find: cap(320, 352, 126),
    formal: cap(494, 352, 150),
    draft: cap(654, 352, 112),

    map: cap(34, 502, 140),
    'render-diff': cap(184, 502, 122),
    'parse-hunks': cap(316, 502, 130),
    hash: cap(494, 502, 150),
    blob: cap(654, 502, 112),

    reader: cap(814, 202, 252),
    mdx: cap(814, 352, 252),
    history: cap(814, 502, 252),

    crypto: cap(560, 620, 140),
  },
  groups: {
    callers: { x: 20, y: 20, w: 460, h: 94 },
    fumadocs: { x: 500, y: 20, w: 240, h: 94 },
    service: { x: 20, y: 170, w: 720, h: 94 },
    compare: { x: 20, y: 320, w: 440, h: 94 },
    marker: { x: 480, y: 320, w: 300, h: 94 },
    diff: { x: 20, y: 470, w: 440, h: 94 },
    span: { x: 480, y: 470, w: 300, h: 94 },
    impl: { x: 800, y: 170, w: 280, h: 394 },
    crypto: null,
  },
  // 线只画到一端的时候，另一端（核对、渲染旧行新行、记录这类）固定高亮时照样亮
  seamPaths: {
    '1': { d: 'M139,100 V202', badge: [139, 150] },
    '2': { d: 'M360,100 V202 M620,100 V150 H360', badge: [360, 150] },
    '3': { d: 'M726,226 H814', badge: [770, 226] },
    '4': { d: 'M374,250 V290 H940 V352', badge: [660, 290] },
    '5': { d: 'M120,250 V352 M290,250 V352', badge: [120, 300] },
    '6': { d: 'M814,376 H766', badge: [790, 376] },
    '7': { d: 'M140,400 V440 H940 V502', badge: [700, 440] },
    '8': { d: 'M90,400 V502', badge: [90, 455] },
    '9': { d: 'M430,400 V455 H569 V502', badge: [500, 455] },
    '10': { d: 'M860,550 V590 H381 V550 M710,590 V550', badge: [600, 590] },
    '11': { d: 'M630,550 V620', badge: [630, 605] },
  },
  entries: {},
  moduleIcons: {
    callers: SquareTerminal,
    fumadocs: Plug,
    service: Cog,
    compare: Scale,
    marker: Tag,
    diff: GitCompare,
    span: Hash,
    impl: Wrench,
    crypto: Lock,
  },
  entryIcons: {},
};
