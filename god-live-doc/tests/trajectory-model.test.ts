/**
 * 模型层的规则测试：树提取的择优规则、四层校验（形状 / 存在性 / 一致性 / livedoc 引用记号，
 * livedoc 一条在 trajectory-validate.test.ts 单开）、parent 归盘即上盘（含未分道哨兵）、
 * merged-in 平铺投影（含递归摊入与环保护）、根卡认定（type: root）、正文 inline 边求解、
 * 里程碑从根卡正文解析、盘清单、扫盘空态。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDisks, buildModel, dayNum, NO_DOMAIN, RingsLayout, scanDir } from "@godcreator02/live-doc-trajectory";
import { card, D, DN, flatProblems, memCards, memSick, root } from "./trajectory-helpers.ts";

/** 一月内某日转天序数。 */
const dn = (day: number): number => dayNum(DN(day));

test("主干择优比终点：终点更晚的短链赢，长链成支线", () => {
  const m = buildModel(
    memCards([
      card("aa01-起点", { domain: "域一" }),
      card("aa02-长链一", { "born-at": D(2) }, { body: "supersedes:: [[aa01-起点]]" }),
      card("aa03-长链二", { "born-at": D(3) }, { body: "supersedes:: [[aa02-长链一]]" }),
      card("aa05-短链终点更晚", { "born-at": D(4) }, { body: "supersedes:: [[aa01-起点]]" }),
    ]),
    "pj01",
  );
  assert.equal(m.trees.length, 1);
  assert.deepEqual(m.trees[0]?.spine, ["aa01-起点", "aa05-短链终点更晚"]);
  /* 长链整条成了支线 */
  assert.deepEqual(m.trees[0]?.sublines.flat().sort(), ["aa02-长链一", "aa03-长链二"]);
});

test("纯转向树退化：一条取代边都没有时主干沿转向链走", () => {
  const m = buildModel(
    memCards([
      card("bb01-源头", { domain: "域一" }),
      card("bb02-长出一", { "born-at": D(2) }, { body: "pivots-from:: [[bb01-源头]]" }),
      card("bb03-长出二", { "born-at": D(3) }, { body: "pivots-from:: [[bb02-长出一]]" }),
    ]),
    "pj01",
  );
  assert.equal(m.trees.length, 1);
  assert.deepEqual(m.trees[0]?.spine, ["bb01-源头", "bb02-长出一", "bb03-长出二"]);
});

test("支线时间不搭界共槽，搭界另开槽", () => {
  const m = buildModel(
    memCards([
      card("aa01-主干头", { domain: "域一" }),
      card("aa02-主干尾", { "born-at": D(30) }, { body: "supersedes:: [[aa01-主干头]]" }),
      card("cc01-支线甲", { "born-at": D(5) }, { body: "pivots-from:: [[aa01-主干头]]" }),
      card("cc02-支线乙隔得远", { "born-at": D(28) }, { body: "pivots-from:: [[aa02-主干尾]]" }),
      card("cc03-支线丙跟甲搭界", { "born-at": D(6) }, { body: "pivots-from:: [[aa01-主干头]]" }),
    ]),
    "pj01",
  );
  const box = new RingsLayout(m).treeBoxes[0];
  /* 甲乙时间隔开（净空 2 天以上）复用同一条槽；丙贴着甲，只能另开 */
  assert.equal(box?.pos["cc01-支线甲"], box?.pos["cc02-支线乙隔得远"]);
  assert.notEqual(box?.pos["cc03-支线丙跟甲搭界"], box?.pos["cc01-支线甲"]);
  assert.equal(box?.slots, 3);
});

test("被取代从链上读：有取代出边的卡进 supersededIds", () => {
  const m = buildModel(
    memCards([
      card("aa01-旧", { domain: "域一" }),
      card("aa02-新", { "born-at": D(2) }, { body: "supersedes:: [[aa01-旧]]" }),
      card("aa03-孤", { "born-at": D(3), domain: "域一" }),
    ]),
    "pj01",
  );
  assert.deepEqual([...m.supersededIds], ["aa01-旧"]);
  assert.deepEqual(m.isolated.map((c) => c.id), ["aa03-孤"]);
});

test("正文 inline 边：目标在本盘卡集合里的成边，一行一条、可多条", () => {
  const m = buildModel(
    memCards([
      card("aa01-甲", { domain: "域一" }),
      card("aa02-乙", { "born-at": D(2), domain: "域一" }),
      card("aa03-丙", { "born-at": D(3), domain: "域一" }),
      card(
        "dd01-丁",
        { "born-at": D(4), domain: "域一" },
        {
          body: [
            "叙事一段。",
            "supersedes:: [[aa01-甲|换个叫法]]",
            "pivots-from:: [[aa02-乙#某一节]]",
            "supersedes:: [[aa03-丙]]",
          ].join("\n"),
        },
      ),
    ]),
    "pj01",
  );
  assert.deepEqual(m.edges, [
    { from: "aa01-甲", to: "dd01-丁", kind: "supersede" },
    { from: "aa02-乙", to: "dd01-丁", kind: "pivot" },
    { from: "aa03-丙", to: "dd01-丁", kind: "supersede" },
  ]);
  assert.deepEqual(m.broken, []);
});

test("指向本盘卡集合外的关系收进 broken 示众", () => {
  const m = buildModel(
    memCards([
      card("aa01-在的", { domain: "域一" }),
      card("dd01-指空", { "born-at": D(2), domain: "域一" }, { body: "supersedes:: [[zz99-不存在的卡]]" }),
    ]),
    "pj01",
  );
  assert.deepEqual(m.edges, []);
  assert.deepEqual(m.broken, [{ id: "dd01-指空", key: "supersedes", target: "zz99-不存在的卡" }]);
});

test("行头是关系字段但行形不合的进 sick（文件级病）——不静默吞行", () => {
  const specs = [
    card("aa01-在的", { domain: "域一" }),
    card(
      "dd01-写歪",
      { "born-at": D(2), domain: "域一" },
      { body: ["supersedes:: [[aa01-在的]] 多了句尾巴", "pivots-from:: 忘了包 wikilink"].join("\n") },
    ),
  ];
  const m = buildModel(memCards(specs), "pj01");
  assert.deepEqual(m.edges, []);
  assert.deepEqual(m.broken, []);
  assert.deepEqual(flatProblems(memSick(specs)), [
    {
      path: "dd01-写歪.md",
      field: "relation",
      value: "[[aa01-在的]] 多了句尾巴",
      reason: "supersedes:: 后须是 [文字](卡身份.md) 形态的一行",
    },
    {
      path: "dd01-写歪.md",
      field: "relation",
      value: "忘了包 wikilink",
      reason: "pivots-from:: 后须是 [文字](卡身份.md) 形态的一行",
    },
  ]);
});

test("内卡写 type 不报病——取值一概不校验，照常上盘", () => {
  const specs = [card("dd01-写type的内卡", { domain: "域一", type: "choice" })];
  assert.deepEqual(memSick(specs), []);
  assert.deepEqual(buildModel(memCards(specs), "pj01").cards.map((c) => c.id), ["dd01-写type的内卡"]);
});

test("缺 born-at / parent / label 都报病（内卡 parent 必填）", () => {
  const specs = [card("dd02-三缺", { domain: "域一", "born-at": "", parent: [], label: "" })];
  assert.deepEqual(flatProblems(memSick(specs)), [
    { path: "dd02-三缺.md", field: "born-at", value: "", reason: "缺 born-at（全卡必填）" },
    { path: "dd02-三缺.md", field: "parent", value: "", reason: "缺 parent（内卡必填；根卡可缺）" },
    { path: "dd02-三缺.md", field: "label", value: "", reason: "缺 label（全卡必填）" },
  ]);
});

test("born-at 两种长度合法，坏格式报病且不上盘", () => {
  const specs = [
    card("dd03-日级存量", { domain: "域一", "born-at": "2026-01-05" }),
    card("dd04-分钟级", { domain: "域一", "born-at": "2026-01-06T09:30" }),
    card("dd05-坏格式", { domain: "域一", "born-at": "2026-1-7" }),
    card("dd06-毫秒老格式", { domain: "域一", "born-at": "2026-01-08T00:00:00.000" }),
  ];
  const m = buildModel(memCards(specs), "pj01");
  assert.deepEqual(m.cards.map((c) => c.id), ["dd03-日级存量", "dd04-分钟级"]);
  assert.deepEqual(flatProblems(memSick(specs)), [
    {
      path: "dd05-坏格式.md",
      field: "born-at",
      value: "2026-1-7",
      reason: "born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm",
    },
    {
      path: "dd06-毫秒老格式.md",
      field: "born-at",
      value: "2026-01-08T00:00:00.000",
      reason: "born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm",
    },
  ]);
});

test("parent 元素不是卡身份（带 .md / 带路径）报病，但形状病不挡上盘", () => {
  const specs = [card("dd07-坏parent", { domain: "域一", parent: ["pj01", "docs/别的卡.md"] })];
  assert.deepEqual(flatProblems(memSick(specs)), [
    {
      path: "dd07-坏parent.md",
      field: "parent",
      value: "docs/别的卡.md",
      reason: "parent 元素须为卡身份（文件名主干，不带 .md 与路径）",
    },
  ]);
  assert.deepEqual(buildModel(memCards(specs), "pj01").cards.map((c) => c.id), ["dd07-坏parent"]);
});

test("parent 含自身报病（一致性校验①）", () => {
  const specs = [card("dd09-自指", { domain: "域一", parent: ["pj01", "dd09-自指"] })];
  assert.deepEqual(flatProblems(memSick(specs)), [
    { path: "dd09-自指.md", field: "parent", value: "dd09-自指", reason: "parent 不得包含自身" },
  ]);
});

test("merged-in 出界（⊄ parent）逐项报病（一致性校验②）", () => {
  const specs = [root("sub1", D(1), { fm: { parent: ["pjaa"], "merged-in": ["pjaa", "pjbb"] } })];
  assert.deepEqual(flatProblems(memSick(specs)), [
    { path: "sub1.md", field: "merged-in", value: "pjbb", reason: "merged-in 元素须 ⊆ parent" },
  ]);
});

test("无 type 的内卡写 merged-in 报病（一致性校验③）", () => {
  const specs = [card("dd10-内卡写merged", { domain: "域一", "merged-in": ["pj01"] })];
  assert.deepEqual(flatProblems(memSick(specs)), [
    { path: "dd10-内卡写merged.md", field: "merged-in", value: "pj01", reason: "merged-in 仅根卡可写" },
  ]);
});

test("缺 label 报病但回退标题上盘；身份带日期段时标题是去掉日期的那截", () => {
  const specs = [
    card("dd08-没短名", { domain: "域一", label: "" }),
    card("2026-01-09-no-label", { domain: "域一", label: "", "born-at": D(9) }),
  ];
  const m = buildModel(memCards(specs), "pj01");
  assert.deepEqual(m.cards.map((c) => c.label), ["dd08-没短名", "no-label"]);
  assert.deepEqual(flatProblems(memSick(specs)).map((p) => p.reason), [
    "缺 label（全卡必填）",
    "缺 label（全卡必填）",
  ]);
});

test("六个卡体系字段一个都不沾的文件不是卡：不上盘、不报病", () => {
  const specs = [{ name: "ee01-不是卡", fm: { note: "随手写的" } }];
  assert.deepEqual(memCards(specs), []);
  assert.deepEqual(memSick(specs), []);
});

const VAULT = [
  root("pjaa", D(1)),
  card("aa01-甲项目的卡", { domain: "域一", "born-at": D(5), label: "甲", parent: ["pjaa"] }),
  card("aa02-甲项目未分道的卡", { "born-at": D(6), label: "野", parent: ["pjaa"] }),
  root("pjbb", D(2)),
  card("bb01-乙项目的卡", { domain: "域一", "born-at": D(6), label: "乙", parent: ["pjbb"] }),
  card("cc01-没挂项目的卡", { domain: "域一", "born-at": D(7), label: "散", parent: [] }),
];

test("归盘即上盘：无 domain 的卡也上盘、进未分道哨兵组，根卡认成 model.root，day0 含诞生时刻", () => {
  const m = buildModel(memCards(VAULT), "pjaa");
  assert.equal(m.root?.id, "pjaa");
  assert.equal(m.root?.label, "测试项目");
  assert.deepEqual(m.cards.map((c) => c.id), ["aa01-甲项目的卡", "aa02-甲项目未分道的卡"]);
  /* 未分道哨兵：无 domain 卡归隐式组，压 domains 尾 */
  assert.equal(m.cards[1]?.domain, NO_DOMAIN);
  assert.deepEqual(m.domains, ["域一", NO_DOMAIN]);
  /* 根卡诞生早于首张卡：盘从项目诞生那天起算 */
  assert.equal(m.day0, dayNum(D(1)));
  assert.equal(m.dayMax, dayNum(D(6)));
});

test("同一目录里不同项目各自建模，互不串卡", () => {
  const mb = buildModel(memCards(VAULT), "pjbb");
  assert.deepEqual(mb.cards.map((c) => c.id), ["bb01-乙项目的卡"]);
  assert.deepEqual(mb.domains, ["域一"]);
});

test("卡 parent 多项：父项目盘也收它", () => {
  const m = buildModel(
    memCards([
      root("pjaa", D(1)),
      card("aa01-本项目的卡", { domain: "域一", "born-at": D(3), parent: ["pjaa"] }),
      card("aa02-子项目的卡", { domain: "域一", "born-at": D(4), parent: ["pjaa", "sub1"] }),
    ]),
    "pjaa",
  );
  assert.deepEqual(m.cards.map((c) => c.id), ["aa01-本项目的卡", "aa02-子项目的卡"]);
});

test("子项目根卡投影为所属项目盘上的虫洞：自己的盘认主、无虫洞；父盘虫洞按 born-at 定盘界", () => {
  const cards = memCards([
    root("pjaa", D(1)),
    card("aa01-父项目的卡", { domain: "域一", "born-at": D(4), parent: ["pjaa"] }),
    root("sub1", D(6), { fm: { parent: ["pjaa"], label: "子项目" } }),
  ]);
  const parent = buildModel(cards, "pjaa");
  assert.deepEqual(parent.cards.map((c) => c.id), ["aa01-父项目的卡"]);
  assert.deepEqual(parent.wormholes.map((w) => w.id), ["sub1"]);
  assert.equal(parent.wormholes[0]?.label, "子项目");
  assert.equal(parent.dayMax, dayNum(D(6)));
  const sub = buildModel(cards, "sub1");
  assert.equal(sub.root?.id, "sub1");
  assert.deepEqual(sub.wormholes, []);
});

test("多父分发：parent 每一项各投一个虫洞", () => {
  const cards = memCards([
    root("pjaa", D(1)),
    root("pjbb", D(1)),
    root("sub1", D(3), { fm: { parent: ["pjaa", "pjbb"] } }),
  ]);
  assert.deepEqual(buildModel(cards, "pjaa").wormholes.map((w) => w.id), ["sub1"]);
  assert.deepEqual(buildModel(cards, "pjbb").wormholes.map((w) => w.id), ["sub1"]);
});

test("一致性校验：根卡 parent 含自身也报病，认主与虫洞投影不受影响", () => {
  const specs = [root("pjaa", D(1)), root("sub1", D(3), { fm: { parent: ["pjaa", "sub1"] } })];
  const cards = memCards(specs);
  assert.equal(buildModel(cards, "sub1").root?.id, "sub1");
  assert.deepEqual(buildModel(cards, "pjaa").wormholes.map((w) => w.id), ["sub1"]);
  const bad = flatProblems(memSick(specs)).filter((p) => p.path === "sub1.md");
  assert.equal(bad.length, 1);
  assert.equal(bad[0]?.field, "parent");
});

test("merged-in 列出的父盘：子项目根卡画普通节点，内卡摊入，父盘不画虫洞", () => {
  const cards = memCards([
    root("pjaa", D(1)),
    card("aa01-父项目的卡", { domain: "域一", "born-at": D(2), parent: ["pjaa"] }),
    root("sub1", D(3), { fm: { parent: ["pjaa"], "merged-in": ["pjaa"], label: "子项目" } }),
    card("bb01-子项目的卡", { domain: "域二", "born-at": D(4), label: "子卡", parent: ["sub1"] }),
  ]);
  const m = buildModel(cards, "pjaa");
  assert.deepEqual(m.wormholes, []);
  assert.deepEqual(m.cards.map((c) => c.id).sort(), ["aa01-父项目的卡", "bb01-子项目的卡", "sub1"]);
  const subNode = m.cards.find((c) => c.id === "sub1");
  assert.equal(subNode?.label, "子项目");
  assert.equal(subNode?.bornAt, D(3));
  assert.deepEqual(buildModel(cards, "sub1").cards.map((c) => c.id), ["bb01-子项目的卡"]);
});

test("递归摊入：孙项目通过被平铺的子项目继续摊平，两级都进父盘", () => {
  const m = buildModel(
    memCards([
      root("pjaa", D(1)),
      root("sub1", D(2), { fm: { parent: ["pjaa"], "merged-in": ["pjaa"], label: "子项目" } }),
      root("sub2", D(3), { fm: { parent: ["sub1"], "merged-in": ["sub1"], label: "孙项目" } }),
      card("cc01-孙项目的卡", { domain: "域三", "born-at": D(4), label: "孙卡", parent: ["sub2"] }),
    ]),
    "pjaa",
  );
  assert.deepEqual(m.wormholes, []);
  assert.deepEqual(m.cards.map((c) => c.id).sort(), ["cc01-孙项目的卡", "sub1", "sub2"]);
});

test("递归摊入连它自己的虫洞也带上父盘：子项目没平铺的孙项目仍在父盘现出虫洞", () => {
  const m = buildModel(
    memCards([
      root("pjaa", D(1)),
      root("sub1", D(2), { fm: { parent: ["pjaa"], "merged-in": ["pjaa"], label: "子项目" } }),
      root("sub2", D(3), { fm: { parent: ["sub1"], label: "孙项目仍虫洞" } }),
    ]),
    "pjaa",
  );
  assert.deepEqual(m.cards.map((c) => c.id), ["sub1"]);
  assert.deepEqual(m.wormholes.map((w) => w.id), ["sub2"]);
});

test("环保护：A、B 互相 merged-in 不死循环，重逢的盘直接停止展开", () => {
  const m = buildModel(
    memCards([
      root("aaaa", D(1), { fm: { parent: ["bbbb"], "merged-in": ["bbbb"] } }),
      root("bbbb", D(1), { fm: { parent: ["aaaa"], "merged-in": ["aaaa"] } }),
    ]),
    "aaaa",
  );
  assert.deepEqual(m.cards.map((c) => c.id), ["bbbb"]);
  assert.deepEqual(m.wormholes, []);
});

test("buildDisks：每张根卡一张盘，带成员卡身份；虫洞不算成员；序按最近有活动降序", () => {
  const disks = buildDisks(
    memCards([
      root("pjaa", D(1)),
      card("aa01-甲", { domain: "域一", "born-at": D(9), parent: ["pjaa"] }),
      root("pjbb", D(2)),
      card("bb01-乙", { domain: "域二", "born-at": D(3), parent: ["pjbb"] }),
      root("sub1", D(6), { fm: { parent: ["pjaa"] } }),
    ]),
  );
  assert.deepEqual(disks, [
    { rootId: "pjaa", memberIds: ["aa01-甲"] },
    { rootId: "sub1", memberIds: [] },
    { rootId: "pjbb", memberIds: ["bb01-乙"] },
  ]);
});

test("buildDisks：一张根卡都没有，盘清单为空", () => {
  assert.deepEqual(buildDisks(memCards([card("aa01-孤零零", { domain: "域一" })])), []);
});

test("根卡带里程碑，内卡恒 null", () => {
  const body = [
    "## 在做什么",
    "",
    "正文若干。",
    "",
    "## 里程碑",
    "",
    "- 2026-01-10｜首座｜第一座里程碑的说明。",
    "- 2026-01-20｜次座",
  ].join("\n");
  const cards = memCards([root("pj01", D(1), { body }), card("aa01-内卡", { domain: "域一" })]);
  assert.deepEqual(cards.find((c) => c.id === "pj01")?.milestones, [
    { date: "2026-01-10", name: "首座", desc: "第一座里程碑的说明。" },
    { date: "2026-01-20", name: "次座", desc: "" },
  ]);
  assert.equal(cards.find((c) => c.id === "aa01-内卡")?.milestones, null);
});

test("根卡没这块即空列表", () => {
  const cards = memCards([root("pj01", D(1), { body: "## 在做什么\n\n没里程碑。" })]);
  assert.deepEqual(cards[0]?.milestones, []);
});

test("日期范围裁剪：范围外的卡不上盘，越界边丢弃但不进 broken 示众", () => {
  const m = buildModel(
    memCards([
      card("aa01-窗外旧卡", { domain: "域一" }),
      card("aa02-窗内新卡", { "born-at": D(10), domain: "域一" }, { body: "supersedes:: [[aa01-窗外旧卡]]" }),
    ]),
    "pj01",
    { d0: dn(5), d1: dn(31) },
  );
  assert.deepEqual(m.cards.map((c) => c.id), ["aa02-窗内新卡"]);
  assert.equal(m.edges.length, 0);
  assert.equal(m.broken.length, 0);
  assert.equal(m.supersededIds.has("aa01-窗外旧卡"), true);
  assert.deepEqual(m.domains, ["域一"]);
});

test("窗内断裂：取代链头在窗外，窗内余段自成一树", () => {
  const m = buildModel(
    memCards([
      card("aa01-链头", { domain: "域一" }),
      card("aa02-链中", { "born-at": D(10), domain: "域一" }, { body: "supersedes:: [[aa01-链头]]" }),
      card("aa03-链尾", { "born-at": D(12), domain: "域一" }, { body: "supersedes:: [[aa02-链中]]" }),
    ]),
    "pj01",
    { d0: dn(5), d1: dn(31) },
  );
  assert.equal(m.trees.length, 1);
  assert.deepEqual(m.trees[0]?.spine, ["aa02-链中", "aa03-链尾"]);
});

test("虫洞落点在窗外也不上盘", () => {
  const m = buildModel(
    memCards([root("pj01", D(1)), card("aa01-窗内卡", { "born-at": D(10) }), root("wh01", D(2), { fm: { parent: ["pj01"] } })]),
    "pj01",
    { d0: dn(5), d1: dn(31) },
  );
  assert.equal(m.wormholes.length, 0);
  assert.deepEqual(m.cards.map((c) => c.id), ["aa01-窗内卡"]);
});

test("盘界钉下不钉上：下界钉窗口起点（不早于项目诞生），上界取窗内最晚活动", () => {
  const m = buildModel(
    memCards([root("pj01", D(1)), card("aa01-近卡一", { "born-at": D(20) }), card("aa02-近卡二", { "born-at": D(25) })]),
    "pj01",
    { d0: dn(10), d1: dn(31) },
  );
  assert.equal(m.day0, dn(10));
  assert.equal(m.dayMax, dn(25));
});

test("窗口起点早于项目诞生：下界由根卡诞生时刻托底", () => {
  const m = buildModel(memCards([root("pj01", D(5)), card("aa01-首卡", { "born-at": D(8) })]), "pj01", {
    d0: dn(1),
    d1: dn(31),
  });
  assert.equal(m.day0, dn(5));
});

test("窗内无卡：空盘，day0 = dayMax = 窗口下界", () => {
  const m = buildModel(memCards([root("pj01", D(1)), card("aa01-旧卡", { "born-at": D(3) })]), "pj01", {
    d0: dn(10),
    d1: dn(20),
  });
  assert.equal(m.cards.length, 0);
  assert.equal(m.day0, dn(10));
  assert.equal(m.dayMax, dn(10));
});

test("扫盘：目录不存在，回空集合，不报错、不建目录", async () => {
  assert.deepEqual(await scanDir("D:/这个目录不存在/也不该被建出来"), { cards: [], sick: [] });
});
