/**
 * StarDisk 客户端组件的结构测试：`react-dom/server` 把它渲成静态 html，断言 SVG 的
 * 骨架数量——节点的 `a[target=_blank]` 数、扇环框数、里程碑环数分别等于模型的卡数、树数、
 * 范围内里程碑数。data 用工作区自带的 107 张诗名 fixture 建（tests/fixtures/trajectory），
 * `size` 给死一个数字，绕开 ResizeObserver（SSR / 测试环境没有它）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildTrajectory, inRange } from "@godcreator02/live-doc-trajectory";
import { StarDisk } from "@godcreator02/live-doc-trajectory/react";

const ROOT_ID = "tfix-测试项目根卡";

test("StarDisk：SVG 骨架数量对得上模型——节点链接数、扇环框数、里程碑环数", async () => {
  const data = await buildTrajectory("tests/fixtures/trajectory");
  const model = data.models[ROOT_ID];
  assert.ok(model, "fixture 里得有 tfix 这张盘");
  const root = data.cards.find((c) => c.id === ROOT_ID);
  assert.ok(root?.milestones);

  const html = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", size: 800 }),
  );

  assert.match(html, /<svg/, "得有 svg 画布");
  const links = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)];
  assert.equal(links.length, model!.cards.length, "节点链接数该等于上盘卡数（虫洞不算）");

  const boxes = [...html.matchAll(/class="star-treebox(?: star-isobox)?"/g)];
  // treebox 类同时覆盖树的扇环框与孤星/虫洞带（isobox 变体），只数不带 isobox 的那部分即树扇环
  const treeBoxes = boxes.filter((m) => !m[0].includes("star-isobox"));
  assert.equal(treeBoxes.length, model!.trees.length, "扇环框数该等于树数");

  const msRings = [...html.matchAll(/class="star-ring-milestone"/g)];
  const expectedMs = inRange(root!.milestones!, model!.day0, model!.dayMax).length;
  assert.equal(msRings.length, expectedMs, "里程碑环数该等于根卡范围内的里程碑数");
});
