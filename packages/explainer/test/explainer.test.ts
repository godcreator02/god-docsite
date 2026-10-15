/**
 * 讲解组件包：`./text` 三个函数的输出，以及三种外壳用 `react-dom/server` 渲染出的第一帧——
 * 控制条按钮都在、说明是第一项、画面拿到的是第一项的数据。接缝图：定义时的几种报错、机读文字、渲染出的图。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { createElement } from "react";
import type { SVGProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CasePicker, CodeLines, Diff, Pane, Pill, SeamDiagram, Stepper, Terminal, Timeline, cap } from "../src/site/index.ts";
import type { SeamLayout } from "../src/site/index.ts";
import { defineSeamGraph, seamGraphText } from "../src/core/seam-graph.ts";
import type { SeamGraphInput } from "../src/core/seam-graph.ts";
import { casesText, chaptersText, stepsText } from "../src/core/text.ts";

const STEPS = [
  { title: "写下引用", text: "文档里记下源码的行段。" },
  { title: "源码改了", text: "那几行的内容变了。" },
  { title: "确认", text: "人看过后写回新的指纹。" },
];
const CHAPTERS = [
  { title: "开头", text: "什么都还没发生。", duration: 2 },
  { title: "中段", text: "引用开始变黄。", duration: 3 },
];
const CASES = [
  { id: "fresh", label: "没改", text: "指纹一致，绿灯。" },
  { id: "moved", label: "挪了位置", text: "内容还在，只是行号变了。" },
];

test("stepsText：每一步一行「第 n 步 · 标题：说明」", () => {
  assert.deepEqual(stepsText(STEPS), [
    "第 1 步 · 写下引用：文档里记下源码的行段。",
    "第 2 步 · 源码改了：那几行的内容变了。",
    "第 3 步 · 确认：人看过后写回新的指纹。",
  ]);
});

test("chaptersText：每一段一行「第 n 段 · 标题：说明」", () => {
  assert.deepEqual(chaptersText(CHAPTERS), ["第 1 段 · 开头：什么都还没发生。", "第 2 段 · 中段：引用开始变黄。"]);
});

test("casesText：每种情况一行「情况「label」：说明」", () => {
  assert.deepEqual(casesText(CASES), ["情况「没改」：指纹一致，绿灯。", "情况「挪了位置」：内容还在，只是行号变了。"]);
});

/** 说明行（dx-caption）里的纯文字 */
function captionOf(html: string): string {
  const match = /<p class="dx-caption"[^>]*>(.*?)<\/p>/.exec(html);
  assert.ok(match, "没有说明行 dx-caption");
  return match[1]!.replace(/<[^>]+>/g, "");
}

test("Stepper 第一帧：播放、上一步（禁用）、每个步号、下一步、计数都在，说明与画面是第 1 步", () => {
  const html = renderToStaticMarkup(
    createElement(Stepper, {
      steps: STEPS,
      label: "一条引用的一生",
      children: (step, index) => createElement("div", { className: "scene" }, `画面 ${index}：${step.title}`),
    }),
  );
  assert.match(html, /class="dx dx-stepper not-prose"[^>]*tabindex="0"/, "根元素可聚焦，带 not-prose");
  assert.match(html, /aria-label="一条引用的一生"/);
  assert.match(html, /aria-label="播放"/);
  assert.match(html, /<button[^>]*aria-label="上一步"[^>]*disabled=""/, "第 1 步时上一步禁用");
  assert.match(html, /<button[^>]*aria-label="下一步"(?![^>]*disabled)/, "第 1 步时下一步可按");
  assert.equal(html.match(/class="dx-step"/g)?.length, STEPS.length, "每一步一个步号按钮");
  assert.match(html, /aria-current="step"[^>]*>1<\/button>/, "当前是第 1 步");
  assert.match(html, /class="dx-count"[^>]*>1 \/ 3<\/span>/);
  assert.match(html, /<div class="scene">画面 0：写下引用<\/div>/);
  assert.equal(captionOf(html), "写下引用文档里记下源码的行段。");
  // 控制条在画面上方，说明在画面下方
  assert.ok(html.indexOf("dx-bar") < html.indexOf("dx-stage") && html.indexOf("dx-stage") < html.indexOf("dx-caption"));
});

test("Timeline 第一帧：播放、上一步、横条（含章节刻度）、下一步、计数都在，画面拿到 time=0 的第 1 章", () => {
  const frames: { time: number; index: number; progress: number }[] = [];
  const html = renderToStaticMarkup(
    createElement(Timeline, {
      chapters: CHAPTERS,
      children: ({ time, chapter, index, progress }) => {
        frames.push({ time, index, progress });
        return createElement("div", { className: "scene" }, chapter.title);
      },
    }),
  );
  assert.deepEqual(frames, [{ time: 0, index: 0, progress: 0 }]);
  assert.match(html, /class="dx dx-timeline not-prose"[^>]*tabindex="0"/);
  assert.match(html, /aria-label="播放"/);
  assert.match(html, /<button[^>]*aria-label="上一步"[^>]*disabled=""/);
  assert.match(html, /<button[^>]*aria-label="下一步"(?![^>]*disabled)/);
  assert.match(html, /<input type="range" min="0" max="5" step="any"[^>]*value="0"/, "横条的范围是总时长 5 秒");
  assert.equal(html.match(/class="dx-scrub-tick"/g)?.length, 1, "两章之间一个刻度");
  assert.match(html, /class="dx-scrub-tick" style="left:40%"/, "刻度在第 2 章开头（2/5）");
  assert.match(html, /class="dx-count"[^>]*>1 \/ 2<\/span>/);
  assert.equal(captionOf(html), "开头什么都还没发生。");
});

test("CasePicker 第一帧：每种情况一个胶囊，默认选第一个；受控时按 value 选", () => {
  const render = (props: { value?: string; initial?: string }): string =>
    renderToStaticMarkup(
      createElement(CasePicker, {
        cases: CASES,
        ...props,
        children: (item) => createElement("div", { className: "scene" }, item.id),
      }),
    );
  const html = render({});
  assert.match(html, /class="dx dx-cases not-prose"[^>]*tabindex="0"/);
  assert.equal(html.match(/class="dx-case"/g)?.length, CASES.length);
  assert.match(html, /aria-pressed="true"[^>]*>没改<\/button>/);
  assert.match(html, /<div class="scene">fresh<\/div>/);
  assert.equal(captionOf(html), "没改指纹一致，绿灯。");

  assert.equal(captionOf(render({ value: "moved" })), "挪了位置内容还在，只是行号变了。");
  assert.equal(captionOf(render({ initial: "moved" })), "挪了位置内容还在，只是行号变了。");
  assert.throws(() => render({ value: "nope" }), /没有 id 为「nope」的情况/);
});

test("外壳拿到空数组直接报错", () => {
  assert.throws(() => renderToStaticMarkup(createElement(Stepper, { steps: [], children: () => null })), /steps 不能是空数组/);
  assert.throws(() => renderToStaticMarkup(createElement(Timeline, { chapters: [], children: () => null })), /chapters 不能是空数组/);
  assert.throws(
    () => renderToStaticMarkup(createElement(Timeline, { chapters: [{ title: "零", text: "", duration: 0 }], children: () => null })),
    /duration 得是正数秒/,
  );
});

test("零件：卡片带角色色，终端命令行前加 $，代码行的高亮 / 新加 / 改过，新旧行对照，胶囊的 tone 与 role 互斥", () => {
  const pane = renderToStaticMarkup(createElement(Pane, { title: "a.ts", role: "violet", icon: "file", extra: "源码" }, "内容"));
  assert.match(pane, /class="dx-pane" data-role="violet"/);
  assert.match(pane, /class="dx-pane-extra">源码</);

  const term = renderToStaticMarkup(createElement(Terminal, { title: "~/repo", lines: [{ text: "pnpm doc", kind: "cmd" }, "输出", { text: "通过", kind: "ok" }] }));
  assert.equal(term.match(/class="dx-term-light"/g)?.length, 3, "三个点");
  assert.match(term, /data-kind="cmd"><span class="dx-term-prompt">\$ <\/span>pnpm doc</);
  assert.match(term, /data-kind="out">输出</);

  const code = renderToStaticMarkup(
    createElement(CodeLines, { lines: ["a", "b", "c"], start: 10, highlight: [10, 11], tone: "warn", added: [12], changed: [11] }),
  );
  assert.match(code, /class="dx-code" data-tone="warn"/);
  assert.equal(code.match(/data-highlight="true"/g)?.length, 2);
  assert.match(code, /data-added="true"><span class="dx-ln-no">12</);
  assert.match(code, /data-changed="true"><span class="dx-ln-no">11</);

  const diff = renderToStaticMarkup(createElement(Diff, { old: ["x"], now: ["y"] }));
  assert.match(diff, /data-side="old">x<\/div><div class="dx-diff-line" data-side="now">y</);

  assert.match(renderToStaticMarkup(createElement(Pill, { tone: "pending", dot: true }, "未确认")), /data-tone="pending"><span class="dx-dot" data-hollow="true"/);
  assert.throws(() => renderToStaticMarkup(createElement(Pill, { tone: "good", role: "blue" })), /tone 与 role 只能给一个/);
});

const GRAPH: SeamGraphInput = {
  id: "demo",
  title: "演示图",
  intro: "两个模块、一条接缝。",
  frameLabel: "文件",
  modules: [
    { id: "cli", name: "命令行", pkg: "cli.ts", role: "blue", outside: false, blurb: "认参数。", caps: [{ id: "main", name: "入口", ident: "main" }] },
    { id: "disk", name: "磁盘", pkg: "fs", role: null, outside: true, blurb: "文件。", caps: [{ id: "read", name: "读文件", ident: "readFile" }] },
  ],
  entries: [{ id: "human", name: "人", to: "main" }],
  seams: [{ n: 1, name: "读盘", a: ["main"], b: ["read"], iface: "readFile(path)", convention: false, via: "disk", text: "命令行读配置。" }],
};

test("defineSeamGraph：能力 id 重复、模块 id 重复、接缝一端或入口指向不存在的能力、接缝编号重复，定义时当场报错", () => {
  const cli = GRAPH.modules[0]!;
  const seam = GRAPH.seams[0]!;
  assert.throws(() => defineSeamGraph({ ...GRAPH, modules: [...GRAPH.modules, { ...cli, id: "cli2" }] }), /能力 id「main」重复/);
  assert.throws(() => defineSeamGraph({ ...GRAPH, modules: [...GRAPH.modules, { ...cli, caps: [] }] }), /模块 id 重复/);
  assert.throws(() => defineSeamGraph({ ...GRAPH, seams: [{ ...seam, b: ["nope"] }] }), /接缝 1「读盘」一端是不存在的能力「nope」/);
  assert.throws(() => defineSeamGraph({ ...GRAPH, entries: [{ id: "human", name: "人", to: "nope" }] }), /入口「human」指向不存在的「nope」/);
  assert.throws(() => defineSeamGraph({ ...GRAPH, seams: [seam, seam] }), /接缝编号重复/);
  const graph = defineSeamGraph(GRAPH);
  assert.equal(graph.seams[0]!.label, "1 读盘");
  assert.deepEqual(graph.seamsOfModule("disk").map((s) => s.id), ["1"]);
});

test("seamGraphText：图的说明与入口一段，每个模块一段，每条接缝一段", () => {
  assert.deepEqual(seamGraphText(defineSeamGraph(GRAPH)), [
    "两个模块、一条接缝。从外面进来的入口：人 → 入口。",
    "文件「命令行」（cli.ts）：认参数。能力：入口（main）。",
    "框外「磁盘」（fs）：文件。能力：读文件（readFile）。",
    "接缝 1 读盘：命令行读配置。两端：入口 ↔ 读文件。接口：readFile(path)。有代码接口，读写磁盘上的文件。",
  ]);
});

test("SeamDiagram：图例、模块框、能力方块、带编号的接缝、入口都画出来；布局表缺一项直接报错", () => {
  const Glyph = (props: SVGProps<SVGSVGElement>) => createElement("svg", props);
  const layout: SeamLayout = {
    view: { w: 400, h: 200 },
    caps: { main: cap(20, 60, 120), read: cap(240, 60, 120) },
    groups: { cli: { x: 10, y: 30, w: 140, h: 94 }, disk: null },
    seamPaths: { "1": { d: "M140,84 H240", badge: [190, 84] } },
    entries: { human: { box: { x: 20, y: 0, w: 60, h: 20 }, arrow: [50, 20, 50, 60] } },
    moduleIcons: { cli: Glyph, disk: Glyph },
    entryIcons: { human: Glyph },
  };
  const graph = defineSeamGraph(GRAPH);
  const html = renderToStaticMarkup(createElement(SeamDiagram, { graph, layout }));
  assert.match(html, /class="dx seam-map not-prose"/);
  assert.match(html, /viewBox="0 0 400 200"[^>]*aria-label="演示图"/);
  assert.match(html, /class="sm-module" data-role="blue" data-outside="false"/);
  assert.match(html, /class="sm-module" data-role="slate" data-outside="true"/);
  assert.equal(html.match(/class="sm-cap"/g)?.length, 2);
  assert.equal(html.match(/class="sm-frame"/g)?.length, 1, "框外只有一个能力的模块写 null，不画外框");
  assert.match(html, /class="sm-seam" data-via="disk"><path d="M140,84 H240"/);
  assert.match(html, /aria-label="接缝 1 读盘"/);
  assert.match(html, /class="sm-entry"/);
  assert.match(html, /从外面进来的入口/, "有入口时图例带上入口");

  const { human: _dropped, ...entriesWithoutHuman } = layout.entries;
  assert.throws(() => renderToStaticMarkup(createElement(SeamDiagram, { graph, layout: { ...layout, entries: entriesWithoutHuman } })), /布局表里没有入口「human」/);
});
