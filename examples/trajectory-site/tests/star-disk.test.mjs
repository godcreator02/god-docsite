/**
 * StarDisk 的结构测试：`buildTrajectory("cards")` 建模、`renderToStaticMarkup` 渲成静态
 * html，断言 SVG 骨架数量——节点的 `a[target=_blank]` 数、扇环框数、里程碑环数分别等于
 * 默认盘（disks[0]，本地 107 张诗名卡的 tfix 项目盘）的卡数、树数、范围内里程碑数。
 * `size` 给死一个数字，绕开 ResizeObserver（Node 环境没有它）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
// StarDisk（dist/react.mjs）躺在 ../../god-live-doc/packages/trajectory 底下，是 link: 过来的
// 目录，它 import "react" 时按自己的物理位置往上找，找到的是 god-live-doc 那份 react，
// 跟本站 node_modules 里的 react/react-dom 是两份不同的模块实例——挂 hook 会报
// "Cannot read properties of null (reading 'useRef')"。这两行故意从同一棵 god-live-doc
// 的 node_modules 直接拿 react / react-dom/server，跟 StarDisk 用的是同一份，
// 绕开这个纯 Node 环境（不经过 Next 打包器去重）下的经典双 React 副本问题——
// 真正跑站（next build / start）时 Next 自己的打包器认识 pnpm 的软链、会去重，这个坑只在
// 裸 node --test 直调时才现形。
import { createElement } from "../../../god-live-doc/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../../god-live-doc/node_modules/react-dom/server.js";
import { buildTrajectory, inRange } from "@godcreator02/live-doc-trajectory";
import { StarDisk } from "@godcreator02/live-doc-trajectory/react";

test("StarDisk：SVG 骨架数量对得上默认盘的模型", async () => {
  const data = await buildTrajectory("cards");
  const rootId = data.disks[0].rootId;
  const model = data.models[rootId];
  const root = data.cards.find((c) => c.id === rootId);

  const html = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", size: 800 }),
  );

  assert.match(html, /<svg/);
  const links = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)];
  assert.equal(links.length, model.cards.length, "节点链接数该等于上盘卡数（虫洞不算）");

  const treeBoxes = [...html.matchAll(/class="star-treebox"/g)];
  assert.equal(treeBoxes.length, model.trees.length, "扇环框数该等于树数");

  const msRings = [...html.matchAll(/class="star-ring-milestone"/g)];
  const expectedMs = inRange(root.milestones, model.day0, model.dayMax).length;
  assert.equal(msRings.length, expectedMs, "里程碑环数该等于根卡范围内的里程碑数");
});
