/**
 * 钉码核心内部接缝图（pin.data.mjs）的坐标与图标。调用方在最上，核对与确认、比较器与 hash、hunk 依次往下；
 * 包外的读取器、node:crypto、旧内容来源在右边一列，各自和连着它的那一行对齐。
 */
import { Cog, GitCompare, HardDrive, Hash, History, Lock, Scale, SquareTerminal } from 'lucide-react';
import { cap } from '@godcreator/explainer-player';
import type { SeamLayout } from '@godcreator/explainer-player';

export const pinLayout: SeamLayout = {
  view: { w: 1100, h: 590 },
  caps: {
    load: cap(34, 52, 200),
    pinning: cap(244, 52, 482),

    check: cap(34, 202, 220),
    confirm: cap(264, 202, 220),
    observe: cap(494, 202, 232),
    reader: cap(814, 202, 252),

    judge: cap(34, 352, 136),
    snapshot: cap(180, 352, 130),
    find: cap(320, 352, 126),
    hash: cap(494, 352, 150),
    blob: cap(654, 352, 112),
    crypto: cap(870, 352, 140),

    map: cap(34, 502, 140),
    'render-diff': cap(184, 502, 122),
    'parse-hunks': cap(316, 502, 130),
    history: cap(814, 502, 252),
  },
  groups: {
    callers: { x: 20, y: 20, w: 720, h: 94 },
    pinner: { x: 20, y: 170, w: 720, h: 94 },
    compare: { x: 20, y: 320, w: 440, h: 94 },
    span: { x: 480, y: 320, w: 300, h: 94 },
    diff: { x: 20, y: 470, w: 440, h: 94 },
    reader: null,
    crypto: null,
    history: null,
  },
  // 线只画到一端的时候，另一端（确认、全文找、渲染旧行新行、blob 名这类）固定高亮时照样亮
  seamPaths: {
    '1': { d: 'M134,100 V202', badge: [134, 150] },
    '2': { d: 'M374,100 V202', badge: [374, 150] },
    '3': { d: 'M726,226 H814', badge: [770, 226] },
    '4': { d: 'M120,250 V352 M290,250 V352', badge: [120, 300] },
    '5': { d: 'M150,400 V440 H940 V502', badge: [700, 440] },
    '6': { d: 'M90,400 V502', badge: [90, 455] },
    '7': { d: 'M446,376 H494', badge: [470, 376] },
    '8': { d: 'M814,526 H446', badge: [630, 526] },
    '9': { d: 'M766,376 H870', badge: [818, 376] },
  },
  entries: {},
  moduleIcons: {
    callers: SquareTerminal,
    pinner: Cog,
    compare: Scale,
    span: Hash,
    diff: GitCompare,
    reader: HardDrive,
    crypto: Lock,
    history: History,
  },
  entryIcons: {},
};
