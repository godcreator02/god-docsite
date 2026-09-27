// 用法：node survey.mjs <docfirst-trajectory 的 dist/index.mjs> <docfirst-workflow 的 dist/cards.mjs> <卡目录…>
// 每个卡目录打一行：卡数、树数、孤星数、扇区一圈要多少度（超过 360 走「复用角度」）、
// 同组同日有几处挤了不止一张、最挤一处几张、现有病的条数、断掉的关系条数与前两条。
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [trajectoryDist, cardsDist, ...dirs] = process.argv.slice(2);
if (!trajectoryDist || !cardsDist || dirs.length === 0) {
  throw new Error("用法：node survey.mjs <trajectory dist/index.mjs> <workflow dist/cards.mjs> <卡目录…>");
}
const { buildModel, RingsLayout, NO_DOMAIN } = await import(pathToFileURL(resolve(trajectoryDist)).href);
const { scanCardDir } = await import(pathToFileURL(resolve(cardsDist)).href);

/** 跟 layout.ts 的 angleDemand 同一算法：块宽 + 块间缝（同域 3°，换域再加 9°）+ 首尾那道缝 */
function angleDemand(layout) {
  const all = [...layout.treeBoxes, ...layout.isoBoxes];
  const domains = [...new Set(all.map((box) => box.domain))];
  const noDomainAt = domains.indexOf(NO_DOMAIN);
  if (noDomainAt >= 0) domains.push(...domains.splice(noDomainAt, 1));
  const order = domains.flatMap((domain) => all.filter((box) => box.domain === domain));
  const gap = (a, b) => 3 + (a.domain === b.domain ? 0 : 9);
  let total = 0;
  order.forEach((box, i) => {
    total += box.width;
    if (i > 0) total += gap(order[i - 1], box);
  });
  return order.length ? total + gap(order.at(-1), order[0]) : 0;
}

/** 同一组（一棵树或一个领域的孤星）同一天的卡数，只留大于 1 的 */
function crowdedDays(model) {
  const groupOf = new Map();
  model.trees.forEach((tree, i) => tree.ids.forEach((id) => groupOf.set(id, `tree:${i}`)));
  model.isolated.forEach((card) => groupOf.set(card.id, `iso:${card.domain}`));
  const count = new Map();
  for (const card of model.cards) {
    const key = `${groupOf.get(card.id)}|${card.bornAt.slice(0, 10)}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  return [...count.values()].filter((n) => n > 1);
}

console.log(["站", "卡", "树", "孤星", "一圈要几度", "走哪条", "挤的日子", "最挤", "现有病", "断关系"].join("\t"));
for (const dir of dirs) {
  const scan = await scanCardDir(resolve(dir));
  const model = buildModel(scan.cards);
  const demand = angleDemand(new RingsLayout(model));
  const crowded = crowdedDays(model);
  const problems = scan.sick.reduce((n, file) => n + file.problems.length, 0);
  const broken = model.broken.slice(0, 2).map((b) => `${b.id} -> ${b.target}`).join(" ; ");
  const site = resolve(dir).split(/[\\/]/).at(-4);
  console.log(
    [site, model.cards.length, model.trees.length, model.isolated.length, Math.round(demand),
      demand > 360 ? "复用角度" : "铺满整圈", crowded.length, Math.max(1, ...crowded), problems,
      `${model.broken.length} ${broken}`].join("\t"),
  );
}
