/**
 * docs-explain 包：`./text` 三个函数的输出，以及三种外壳用 `react-dom/server` 渲染出的第一帧——
 * 控制条按钮都在、说明是第一项、画面拿到的是第一项的数据。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CasePicker, CodeLines, Diff, Pane, Pill, Stepper, Terminal, Timeline } from "@godcreator/docs-explain";
import { casesText, chaptersText, stepsText } from "@godcreator/docs-explain/text";

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
