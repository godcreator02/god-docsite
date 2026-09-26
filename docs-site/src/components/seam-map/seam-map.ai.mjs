/**
 * SeamMap 在机读版里变成什么：跟画面读同一份数据（seam-map.data.mjs），
 * 先一段图例与入口，再每个模块一段（包名、它做什么、里面有哪些能力），最后每条接缝一段（编号名称、说明、两端、接口、线型）。
 * 每条接缝的标题与说明就是画面浮层里显示的 label、text 两个字段。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { capById, entries, modules, seams } from './seam-map.data.mjs';

const capNames = (ids) => ids.map((id) => capById.get(id).name).join('、');
const entryTarget = (to) => capById.get(to)?.name ?? modules.find((m) => m.id === to).name;

export function SeamMap(_node, { paragraph }) {
  return [
    paragraph(
      `接缝图：虚线框是模块（docfirst 的 npm 包与工作台插件），框里的方块是能力，跨模块的线带编号就是接缝；实线是代码调用，虚线是读写磁盘上的文件；系统之外的东西画在框外。从外面进来的入口：${entries.map((e) => `${e.name} → ${entryTarget(e.to)}`).join('；')}。`,
    ),
    ...modules.map((m) =>
      paragraph(`${m.outside ? '框外' : '模块'}「${m.name}」（${m.pkg}）：${m.blurb}能力：${m.caps.map((c) => `${c.name}（${c.ident}）`).join('、')}。`),
    ),
    ...seams.map((s) =>
      paragraph(
        `接缝 ${s.label}：${s.text}两端：${capNames(s.a)} ↔ ${capNames(s.b)}。接口：${s.iface}。${s.convention ? '约定，没有代码接口' : '有代码接口'}，${s.via === 'disk' ? '读写磁盘上的文件' : '代码调用'}。`,
      ),
    ),
  ];
}
