import { describe, expect, it } from "vitest";
import { buildTermIndex, findTerms } from "../src/glossary.js";
import type { TermEntry } from "../src/glossary.js";

const terms: TermEntry[] = [
  { term: "命令总线", def: "组件间传命令的一条通道" },
  { term: "总线", def: "多台设备共用的一条传输线" },
  { term: "pane", def: "界面上的一个窗格", aliases: ["panes"] },
  { term: "隔离 home", def: "一套独立的环境", href: "/docs/glossary-demo" },
];

describe("buildTermIndex 建表", () => {
  it("拒空白词", () => {
    expect(() => buildTermIndex([{ term: "  ", def: "x" }])).toThrow("空的表面词");
  });

  it("拒单字词：中文单字会命中一切", () => {
    expect(() => buildTermIndex([{ term: "锚", def: "x" }])).toThrow("只有一个字");
  });

  it("拒两条术语抢同一个表面词", () => {
    expect(() => buildTermIndex(terms)).not.toThrow();
    expect(() =>
      buildTermIndex([
        { term: "甲乙", def: "x", aliases: ["总线"] },
        { term: "总线", def: "y" },
      ]),
    ).toThrow("抢");
  });

  it("别名与词本身都进表面词，且长的排前面（同长按字典序）", () => {
    const index = buildTermIndex(terms);
    const texts = index.surfaces.map((s) => s.text);
    expect(texts).toEqual(expect.arrayContaining(["命令总线", "总线", "pane", "panes", "隔离 home"]));
    expect(texts.slice(0, 2)).toEqual(["隔离 home", "panes"]);
  });
});

describe("findTerms 匹配", () => {
  const index = buildTermIndex(terms);

  it("长词优先：先认「命令总线」，剩下的字不再被「总线」切碎", () => {
    const spans = findTerms("命令总线坏了", index);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.entry.term).toBe("命令总线");
    expect([spans[0]!.start, spans[0]!.end]).toEqual([0, 4]);
  });

  it("西文要词边界：pane 不命中 panel，但命中独立出现的 pane 与复数 panes", () => {
    expect(findTerms("a panel here", index)).toHaveLength(0);
    const hits = findTerms("one pane and two panes", index);
    expect(hits.map((s) => s.entry.term)).toEqual(["pane", "pane"]);
  });

  it("西文两侧紧邻标点算边界", () => {
    expect(findTerms("(pane)", index)).toHaveLength(1);
  });

  it("互不重叠、按出现顺序交回", () => {
    const spans = findTerms("总线，命令总线，pane", index);
    const starts = spans.map((s) => s.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    for (let i = 1; i < spans.length; i += 1) expect(spans[i]!.start).toBeGreaterThanOrEqual(spans[i - 1]!.end);
  });

  it("taken：同一个词一篇只标第一次；没传 taken 就每处都标", () => {
    const once = findTerms("pane 一处，pane 又一处", index, new Set());
    expect(once).toHaveLength(1);
    expect(findTerms("pane 一处，pane 又一处", index)).toHaveLength(2);
  });
});
