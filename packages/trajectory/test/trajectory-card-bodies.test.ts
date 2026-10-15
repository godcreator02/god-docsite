/**
 * 卡正文的浏览器端加载：站点传进来的是卡集合在浏览器端的加载表（键带 `./`），按卡身份找加载函数，
 * 同一身份取 .mdx；同一个加载函数只调一次；CardBody 挂起到正文加载完再渲染。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import type { MDXContent } from "mdx/types";
import { CardBody, cardBodyLoadersById, cardBodyPromise, type CardBodies, type CardBodyModule } from "../src/site/card-bodies.tsx";

const bodyOf = (text: string): (() => Promise<CardBodyModule>) => {
  const Body: MDXContent = () => createElement("p", null, text);
  return async () => ({ default: Body });
};

test("按卡身份找正文：键去掉 ./ 再去后缀，同一身份 .md 与 .mdx 都在取 .mdx，不是卡文件的不收", () => {
  const md = bodyOf("md");
  const mdx = bodyOf("mdx");
  const root = bodyOf("根");
  const bodies: CardBodies = { "./2026-01-02-甲.md": md, "./2026-01-02-甲.mdx": mdx, "./pj01.md": root, "./readme.txt": bodyOf("不是卡") };
  const loaders = cardBodyLoadersById(bodies);
  assert.deepEqual([...loaders.keys()].sort(), ["2026-01-02-甲", "pj01"]);
  assert.equal(loaders.get("2026-01-02-甲"), mdx);
  assert.equal(loaders.get("pj01"), root);
});

test("同一个加载函数只调一次：use() 每次渲染拿到同一个 promise", () => {
  let calls = 0;
  const load = async (): Promise<CardBodyModule> => {
    calls += 1;
    return { default: () => null };
  };
  assert.equal(cardBodyPromise(load), cardBodyPromise(load));
  assert.equal(calls, 1);
});

test("CardBody：等正文加载完再渲染，把站点的 MDX 组件表交给正文", async () => {
  const Body: MDXContent = ({ components }) => createElement("p", null, `正文 · ${Object.keys(components ?? {}).join(",")}`);
  const load = async (): Promise<CardBodyModule> => ({ default: Body });
  const { prelude } = await prerenderToNodeStream(createElement(CardBody, { load, components: { Term: () => null } }));
  let html = "";
  for await (const chunk of prelude) html += String(chunk);
  assert.equal(html, "<p>正文 · Term</p>");
});
