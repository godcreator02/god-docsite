/**
 * 一张接缝图的内容：模块是框，能力是框里的方块，接缝是跨框的带编号连线，入口是从图外进来的箭头。
 * 全局图（seam-map.data.mjs）和每个包的内部图（inner/*.data.mjs）都用它定义；画面（diagram.tsx）与机读规则
 * （seam-map.ai.mjs）只读它交回的对象。接缝两端或入口指向不存在的能力、id 重复，定义时当场报错。
 * 这个文件不 import React，docfirst.config.mjs 经机读规则加载它，命令行也能运行。
 *
 * @typedef {'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate'} Role
 * @typedef {{ id: string, name: string, ident: string }} Capability
 * @typedef {{ id: string, name: string, pkg: string, role: Role | null, outside: boolean, blurb: string, caps: Capability[] }} Module
 * @typedef {{ id: string, name: string, to: string }} Entry
 * @typedef {{ n: number, name: string, a: string[], b: string[], iface: string, convention: boolean, via: 'code' | 'disk', text: string }} SeamInput
 * @typedef {SeamInput & { id: string, label: string }} Seam
 * @typedef {{ id: string, title: string, intro: string, frameLabel: string, modules: Module[], entries: Entry[], seams: SeamInput[] }} GraphInput
 */

/** @param {GraphInput} input */
export function defineSeamGraph({ id, title, intro, frameLabel, modules, entries, seams }) {
  /** @type {Map<string, Module>} */
  const moduleOfCap = new Map();
  /** @type {Map<string, Capability>} */
  const capById = new Map();
  for (const m of modules) {
    for (const c of m.caps) {
      if (capById.has(c.id)) throw new Error(`接缝图「${id}」里能力 id「${c.id}」重复`);
      capById.set(c.id, c);
      moduleOfCap.set(c.id, m);
    }
  }
  const moduleIds = new Set(modules.map((m) => m.id));
  if (moduleIds.size !== modules.length) throw new Error(`接缝图「${id}」里模块 id 重复`);
  for (const e of entries) {
    if (!capById.has(e.to) && !moduleIds.has(e.to)) throw new Error(`接缝图「${id}」的入口「${e.id}」指向不存在的「${e.to}」`);
  }
  /** @type {Seam[]} */
  const numbered = seams.map((s) => {
    for (const cap of [...s.a, ...s.b]) {
      if (!capById.has(cap)) throw new Error(`接缝图「${id}」的接缝 ${s.n}「${s.name}」一端是不存在的能力「${cap}」`);
    }
    return { ...s, id: String(s.n), label: `${s.n} ${s.name}` };
  });
  if (new Set(numbered.map((s) => s.id)).size !== numbered.length) throw new Error(`接缝图「${id}」里接缝编号重复`);

  /** 跟一个模块有关的接缝：任一端落在这个模块的能力上 */
  const seamsOfModule = (/** @type {string} */ moduleId) =>
    numbered.filter((s) => [...s.a, ...s.b].some((cap) => moduleOfCap.get(cap)?.id === moduleId));

  return { id, title, intro, frameLabel, modules, entries, seams: numbered, moduleOfCap, capById, seamsOfModule };
}

/** @typedef {ReturnType<typeof defineSeamGraph>} SeamGraph */
