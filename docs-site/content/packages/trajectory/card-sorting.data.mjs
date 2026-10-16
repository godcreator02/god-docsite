/**
 * CardSorting（「trajectory：轨迹卡与星轨盘」那一页「一批卡」一节）的全部数据，画面（card-sorting.tsx）只读这一份。
 * 例子是为讲解编的一个小项目卡目录，与 disk-placement.data.mjs 是同一个贯穿例子：盘心、①–⑨、病卡 ✗ 共 11 个文件，
 * 文件名两边一致；label 与 born-at 照正文例子的表。
 */

/** 11 个文件与它们的去处（dest 是三栏之一） */
export const files = [
  { mark: '盘心', name: '2026-03-01-start.md', dest: 'center' },
  { mark: '①', name: '2026-03-02-json-files.mdx', dest: 'cards' },
  { mark: '②', name: '2026-03-06-sqlite.mdx', dest: 'cards' },
  { mark: '③', name: '2026-03-09-sqlite-wal.mdx', dest: 'cards' },
  { mark: '④', name: '2026-03-12-wal-network-drive.mdx', dest: 'cards' },
  { mark: '⑤', name: '2026-03-15-lock-file.mdx', dest: 'cards' },
  { mark: '⑥', name: '2026-04-20-one-file-per-record.mdx', dest: 'cards' },
  { mark: '⑦', name: '2026-03-06-dark-theme.mdx', dest: 'cards' },
  { mark: '⑧', name: '2026-03-06-sidebar-tree.mdx', dest: 'cards' },
  { mark: '⑨', name: '2026-04-21-search-box.mdx', dest: 'cards' },
  { mark: '✗', name: '2026-03-18-cache.mdx', dest: 'sick' },
];

/** 盘心：根卡恰好一张时它是盘心 */
export const centerCard = { mark: '盘心', label: '起步', bornAt: '2026-03-01' };

/** 上盘的 9 张（编号、label、born-at） */
export const diskCards = [
  { mark: '①', label: '记录存成 JSON 文件', bornAt: '2026-03-02' },
  { mark: '②', label: '改用 SQLite', bornAt: '2026-03-06' },
  { mark: '③', label: '开 WAL 模式', bornAt: '2026-03-09' },
  { mark: '④', label: '网络盘上 WAL 不可用', bornAt: '2026-03-12' },
  { mark: '⑤', label: '改用锁文件', bornAt: '2026-03-15' },
  { mark: '⑥', label: '一条记录一个文件', bornAt: '2026-04-20' },
  { mark: '⑦', label: '深色主题跟系统', bornAt: '2026-03-06' },
  { mark: '⑧', label: '侧栏用文件树', bornAt: '2026-03-06' },
  { mark: '⑨', label: '搜索框放顶栏', bornAt: '2026-04-21' },
];

/** 病卡 ✗：born-at 写成了「三月十八号」，reason 是 core 报病时的原话 */
/* ref file="../packages/trajectory/src/core/card.ts" lines="43-43" hash="63f8e12a2088" blob="5c75a339d919" */
export const sickCard = {
  mark: '✗',
  label: '加一层缓存',
  bornAt: '三月十八号',
  reason: 'born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm',
};

/** 三栏下面那行灰字 */
export const note = '上盘的门槛只有 born-at 写得对；parent 写错、关系指错这些病不挡上盘，但照样报病。';
