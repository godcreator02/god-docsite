/**
 * StarDisk 的壳结构测试：`buildTrajectory("cards")` 建模、`renderToStaticMarkup` 渲成静态 html。
 * 壳只当编排者——画布层（六层 SVG）挂载后才由画布层建，静态渲染那一趟画布区是空 div；
 * 这里断言的是这个站真用的两种形态：`?disk=` 给了渲盘（画布容器、竖轨容器、工具条、无遮罩），
 * 缺失渲启动器卡阵（一张盘一张卡、每张卡带服务端渲的静态定妆照 svg）。
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
import { buildTrajectory } from "@godcreator02/live-doc-trajectory";
import { StarDisk } from "@godcreator02/live-doc-trajectory/react";
import { launcherThumbs } from "@godcreator02/live-doc-trajectory/server";

test("StarDisk mode=page 带 ?disk=：壳结构齐——画布空 div、竖轨容器、工具条，无遮罩", async () => {
  const data = await buildTrajectory("cards");
  const rootId = data.disks[0].rootId;

  const html = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", size: 800, mode: "page", initialDisk: rootId }),
  );

  assert.match(html, /class="star-disk star-disk-page star-active"/, "整页模式的容器类，交互态恒真");
  assert.match(html, new RegExp(`<div class="star-canvas" data-disk="${rootId}"[^>]*></div>`), "画布区是空 div，svg 挂载后由画布层建");
  assert.doesNotMatch(html, /<svg[^>]*class="star-svg"/, "静态渲染那一趟没有画布 svg");
  assert.match(html, /class="star-rail"/, "竖轨容器在");
  assert.match(html, /class="star-hud-top"/, "工具条在");
  assert.match(html, /title="启动器（换项目盘）"/, "盘内有回启动器的钮");
  assert.doesNotMatch(html, /star-activate-overlay|star-activate-hint/, "整页模式没有激活遮罩也没有提示带");
  assert.doesNotMatch(html, /title="全屏"|class="star-tab/, "全屏按钮与盘页签已退役");
});

test("StarDisk mode=page 没有 ?disk=：启动器卡阵——一张盘一张卡，每张卡带静态定妆照", async () => {
  const data = await buildTrajectory("cards");
  const thumbs = launcherThumbs(data);
  const html = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", mode: "page", thumbs }),
  );
  assert.match(html, /class="star-launcher"/);
  const cards = [...html.matchAll(/class="star-launcher-card"/g)];
  assert.equal(cards.length, data.disks.length, "一张盘一张卡");
  const svgs = [...html.matchAll(/<svg viewBox="[^"]+" class="trajectory-thumb star-thumb-(dark|light)">/g)];
  assert.equal(svgs.length, data.disks.length * 2, "每张卡带亮暗各一份静态 svg");
  assert.match(html, /最近活动 \d{4}-\d{2}-\d{2}/, "卡下方有最近活动日期");
});
