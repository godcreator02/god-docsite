/**
 * TrunkPick（「trajectory：轨迹卡与星轨盘」那一页「建模」一节）的全部数据，画面（trunk-pick.tsx）只读这一份。
 * 例子与 disk-placement.data.mjs 是同一个贯穿例子（为讲解拼的）：①–⑥ 连成一棵树、⑦⑧⑨ 孤星；
 * 连通分量、起点、候选与主干的结论按 core/model/build.ts 的规则（extractTrees 与它的择优函数）跑这个例子跑出来的。
 */

/** 树上的节点：mark、born-at（MM-DD）、领域；superseded 是有取代出边（被别的卡取代，盘上淡出） */
export const nodes = [
  { mark: '①', date: '03-02', domain: '存储', superseded: true },
  { mark: '②', date: '03-06', domain: '存储', superseded: true },
  { mark: '③', date: '03-09', domain: '存储', superseded: true },
  { mark: '④', date: '03-12', domain: '存储', superseded: false },
  { mark: '⑤', date: '03-15', domain: '存储', superseded: false },
  { mark: '⑥', date: '04-20', domain: '存储', superseded: false },
  { mark: '⑦', date: '03-06', domain: '界面', superseded: false },
  { mark: '⑧', date: '03-06', domain: '界面', superseded: false },
  { mark: '⑨', date: '04-21', domain: '界面', superseded: false },
];

/** 关系边：from 是被取代的旧卡或转向的起点（与 disk-placement.data.mjs 的 edges 一致） */
export const edges = [
  { from: '①', to: '②', kind: 'supersede' },
  { from: '②', to: '③', kind: 'supersede' },
  { from: '③', to: '④', kind: 'supersede' },
  { from: '④', to: '⑤', kind: 'pivot' },
  { from: '②', to: '⑥', kind: 'supersede' },
];

/** 第 2 步的两条候选（挂在各自的终点旁边；链本身在图上描出来了，标签只写张数与终点） */
export const candidates = [
  { at: '④', text: '候选 A · 4 张，终点 03-12' },
  { at: '⑥', text: '候选 B · 3 张，终点 04-20' },
];

/** 第 3 步的两个结论标注 */
export const verdicts = { trunk: '主干 ①②⑥ · 终点 04-20', subline: '③④⑤ 一条支线' };

/** 第 4 步底下的领域顺序：按 born-at 顺序首次出现 */
export const domainOrder = [
  { name: '存储', first: '首次出现 03-02（①）' },
  { name: '界面', first: '首次出现 03-06（⑦）' },
];

/** 五步：title 是控制条上的标题，text 是外壳底部的一行短句，note 是每步右边的一句说明 */
export const steps = [
  {
    title: '连成树',
    text: '取代与转向两种边一起求连通分量',
    note: '①–⑥ 连成一棵树——⑤ 没有取代边，是靠转向从 ④ 连进来的；⑦⑧⑨ 一条关系都没有，是孤星。',
  },
  {
    title: '找起点',
    text: '没有取代入边、又带着取代出边的卡当起点',
    note: '主干只在取代边上选。能当起点的是没有取代入边、又带着取代出边的卡：例子里只有 ①——⑤ 只有转向的入边，取代的出边也没有，当不了起点。',
  },
  {
    title: '两条候选',
    text: '从 ① 出发的两条候选都描出来',
    note: '①→②→③→④ 四张、终点 03-12；①→②→⑥ 三张、终点 04-20。终点写在各条候选的旁边。',
  },
  {
    title: '比终点',
    text: '主干是 ①②⑥，③④⑤ 变成支线',
    note: '比终点不比长度：⑥ 的 04-20 晚于 ④ 的 03-12。不比长度的理由：一条反复微调的支线步数多，按长度选会压过只转折几次的主线。',
  },
  {
    title: '淡出与领域序',
    text: '被取代的 ①②③ 淡出，领域按首次出现排序',
    note: '领域的先后按 born-at 顺序首次出现定：存储（①，03-02）在前、界面（⑦，03-06）在后——扇区的先后靠这个顺序。',
  },
];
