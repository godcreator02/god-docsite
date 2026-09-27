/**
 * 模型层的规则测试：树提取的择优规则、卡格式的四层校验（形状 / 存在性 / 一致性 / docfirst 引用记号，
 * docfirst 那一层在 trajectory-validate.test.ts 单独测；跨文件的三条交给 scanCards 测）、
 * 非根卡全部画到盘上（含未分道哨兵）、盘心认定（卡目录里恰好一张 type: root）、正文 inline 边求解、
 * 里程碑从根卡正文解析、卡目录不存在时扫描结果为空。卡经 workflow 的卡格式换成中性输入，再交给 buildModel。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel } from "@godcreator/trajectory-disk";
import { dayNum, NO_DOMAIN } from "../packages/trajectory-disk/src/model/build.ts";
import { RingsLayout } from "../packages/trajectory-disk/src/layout.ts";
import { scanCardDir } from "@godcreator/docfirst-workflow";
import { card, D, flatProblems, memCards, memSick, root, scanSick } from "./trajectory-helpers.ts";

test("主干择优比终点：终点更晚的短链赢，长链成支线", () => {
  const m = buildModel(
    memCards([
      card("aa01-起点", { domain: "域一" }),
      card("aa02-长链一", { "born-at": D(2) }, { body: "supersedes:: [aa01-起点](aa01-起点.md)" }),
      card("aa03-长链二", { "born-at": D(3) }, { body: "supersedes:: [aa02-长链一](aa02-长链一.md)" }),
      card("aa05-短链终点更晚", { "born-at": D(4) }, { body: "supersedes:: [aa01-起点](aa01-起点.md)" }),
    ]),
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
      card("bb02-长出一", { "born-at": D(2) }, { body: "pivots-from:: [bb01-源头](bb01-源头.md)" }),
      card("bb03-长出二", { "born-at": D(3) }, { body: "pivots-from:: [bb02-长出一](bb02-长出一.md)" }),
    ]),
  );
  assert.equal(m.trees.length, 1);
  assert.deepEqual(m.trees[0]?.spine, ["bb01-源头", "bb02-长出一", "bb03-长出二"]);
});

test("支线时间不搭界共槽，搭界另开槽", () => {
  const m = buildModel(
    memCards([
      card("aa01-主干头", { domain: "域一" }),
      card("aa02-主干尾", { "born-at": D(30) }, { body: "supersedes:: [aa01-主干头](aa01-主干头.md)" }),
      card("cc01-支线甲", { "born-at": D(5) }, { body: "pivots-from:: [aa01-主干头](aa01-主干头.md)" }),
      card("cc02-支线乙隔得远", { "born-at": D(28) }, { body: "pivots-from:: [aa02-主干尾](aa02-主干尾.md)" }),
      card("cc03-支线丙跟甲搭界", { "born-at": D(6) }, { body: "pivots-from:: [aa01-主干头](aa01-主干头.md)" }),
    ]),
  );
  const box = new RingsLayout(m).treeBoxes[0];
  /* 甲乙时间隔开（净空 2 天以上）复用同一条槽；丙跟甲离得太近，只能另开一条 */
  assert.equal(box?.pos["cc01-支线甲"], box?.pos["cc02-支线乙隔得远"]);
  assert.notEqual(box?.pos["cc03-支线丙跟甲搭界"], box?.pos["cc01-支线甲"]);
  assert.equal(box?.slots, 3);
});

test("被取代从链上读：有取代出边的卡进 supersededIds", () => {
  const m = buildModel(
    memCards([
      card("aa01-旧", { domain: "域一" }),
      card("aa02-新", { "born-at": D(2) }, { body: "supersedes:: [aa01-旧](aa01-旧.md)" }),
      card("aa03-孤", { "born-at": D(3), domain: "域一" }),
    ]),
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
            "supersedes:: [换个叫法](aa01-甲.md)",
            "pivots-from:: [aa02-乙](aa02-乙.md#某一节)",
            "supersedes:: [aa03-丙](aa03-丙.md)",
          ].join("\n"),
        },
      ),
    ]),
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
      card("dd01-指空", { "born-at": D(2), domain: "域一" }, { body: "supersedes:: [zz99-不存在的卡](zz99-不存在的卡.md)" }),
    ]),
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
      { body: ["supersedes:: [aa01-在的](aa01-在的.md) 多了句尾巴", "pivots-from:: 忘了写链接"].join("\n") },
    ),
  ];
  const m = buildModel(memCards(specs));
  assert.deepEqual(m.edges, []);
  assert.deepEqual(m.broken, []);
  assert.deepEqual(flatProblems(memSick(specs)), [
    {
      path: "dd01-写歪.md",
      field: "relation",
      value: "[aa01-在的](aa01-在的.md) 多了句尾巴",
      reason: "supersedes:: 后须是 [文字](卡身份.md) 形态的一行",
    },
    {
      path: "dd01-写歪.md",
      field: "relation",
      value: "忘了写链接",
      reason: "pivots-from:: 后须是 [文字](卡身份.md) 形态的一行",
    },
  ]);
});

test("内卡写 type 不报病——取值一概不校验，照常上盘", () => {
  const specs = [card("dd01-写type的内卡", { domain: "域一", type: "choice" })];
  assert.deepEqual(memSick(specs), []);
  assert.deepEqual(buildModel(memCards(specs)).cards.map((c) => c.id), ["dd01-写type的内卡"]);
});

test("缺 born-at / parent / label 都报病（非根卡 parent 必填）", () => {
  const specs = [card("dd02-三缺", { domain: "域一", "born-at": "", parent: [], label: "" })];
  assert.deepEqual(flatProblems(memSick(specs)), [
    { path: "dd02-三缺.md", field: "born-at", value: "", reason: "缺 born-at（全卡必填）" },
    { path: "dd02-三缺.md", field: "parent", value: "", reason: "缺 parent（非根卡必填，写根卡的身份）" },
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
  const m = buildModel(memCards(specs));
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


/* ---------- 跨文件的三条校验：交给 scanCards ---------- */

test("根卡多于一张：每张根卡各报一条 type 病，说明里列出全部根卡；非根卡的 parent 不再逐个比", () => {
  const specs = [
    root("pjaa", D(1)),
    root("pjbb", D(2)),
    card("aa01-挂甲的卡", { "born-at": D(3), parent: ["pjaa"] }),
    card("bb01-挂别处的卡", { "born-at": D(4), parent: ["zz99"] }),
  ];
  const reason = "卡目录里有 2 张根卡（pjaa、pjbb），只能有一张";
  assert.deepEqual(flatProblems(scanSick(specs)), [
    { path: "pjaa.md", field: "type", value: "root", reason },
    { path: "pjbb.md", field: "type", value: "root", reason },
  ]);
  const m = buildModel(memCards(specs));
  assert.equal(m.center, null, "根卡不是恰好一张：盘心无主");
  assert.deepEqual(m.cards.map((c) => c.id), ["aa01-挂甲的卡", "bb01-挂别处的卡"], "非根卡照样全部上盘");
});

test("根卡写了 parent：报一条 parent 病，值是它写的 parent", () => {
  const specs = [root("pjaa", D(1), { fm: { parent: ["zz99", "yy88"] } }), card("aa01-卡", { parent: ["pjaa"] })];
  assert.deepEqual(flatProblems(scanSick(specs)), [
    { path: "pjaa.md", field: "parent", value: "zz99,yy88", reason: "根卡不写 parent" },
  ]);
  assert.equal(buildModel(memCards(specs)).center?.id, "pjaa", "根卡照样认主");
});

test("非根卡的 parent 每个值都得是那张根卡的身份，不是就逐个报，说明里写出根卡身份", () => {
  const specs = [
    root("pjaa", D(1)),
    card("aa01-对的卡", { parent: ["pjaa"] }),
    card("aa02-多写一项", { parent: ["pjaa", "sub1"] }),
    card("aa03-全写错", { parent: ["sub1", "sub2"] }),
  ];
  assert.deepEqual(flatProblems(scanSick(specs)), [
    { path: "aa02-多写一项.md", field: "parent", value: "sub1", reason: "parent 须是根卡的身份 pjaa" },
    { path: "aa03-全写错.md", field: "parent", value: "sub1", reason: "parent 须是根卡的身份 pjaa" },
    { path: "aa03-全写错.md", field: "parent", value: "sub2", reason: "parent 须是根卡的身份 pjaa" },
  ]);
});

test("卡目录里没有根卡：非根卡的每个 parent 值都报「卡目录里没有根卡」", () => {
  const specs = [card("aa01-卡", { parent: ["pj01"] })];
  assert.deepEqual(flatProblems(scanSick(specs)), [
    { path: "aa01-卡.md", field: "parent", value: "pj01", reason: "parent 须指向根卡，但卡目录里没有根卡" },
  ]);
  assert.equal(buildModel(memCards(specs)).center, null);
});

test("parent 写成带路径 / 带后缀的样子或写成自己：同一个值只报一条「须是根卡的身份」，病卡照样上盘", () => {
  const specs = [
    root("pjaa", D(1)),
    card("aa01-带路径", { parent: ["docs/pjaa.md"] }),
    card("aa02-自指", { parent: ["aa02-自指"] }),
  ];
  assert.deepEqual(flatProblems(scanSick(specs)), [
    { path: "aa01-带路径.md", field: "parent", value: "docs/pjaa.md", reason: "parent 须是根卡的身份 pjaa" },
    { path: "aa02-自指.md", field: "parent", value: "aa02-自指", reason: "parent 须是根卡的身份 pjaa" },
  ]);
  assert.deepEqual(buildModel(memCards(specs)).cards.map((c) => c.id), ["aa01-带路径", "aa02-自指"]);
});

test("跨文件的病追加在同一文件单文件的病后面", () => {
  const specs = [root("pjaa", D(1)), card("aa01-缺短名", { label: "", parent: ["zz99"] })];
  assert.deepEqual(flatProblems(scanSick(specs)), [
    { path: "aa01-缺短名.md", field: "label", value: "", reason: "缺 label（全卡必填）" },
    { path: "aa01-缺短名.md", field: "parent", value: "zz99", reason: "parent 须是根卡的身份 pjaa" },
  ]);
});

test("缺 label 报病但回退标题上盘；身份带日期段时标题是去掉日期的那截", () => {
  const specs = [
    card("dd08-没短名", { domain: "域一", label: "" }),
    card("2026-01-09-no-label", { domain: "域一", label: "", "born-at": D(9) }),
  ];
  const m = buildModel(memCards(specs));
  assert.deepEqual(m.cards.map((c) => c.label), ["dd08-没短名", "no-label"]);
  assert.deepEqual(flatProblems(memSick(specs)).map((p) => p.reason), [
    "缺 label（全卡必填）",
    "缺 label（全卡必填）",
  ]);
});

test("卡体系字段一个都不沾的文件不是卡：不上盘、不报病", () => {
  const specs = [{ name: "ee01-不是卡", fm: { note: "随手写的" } }];
  assert.deepEqual(memCards(specs), { center: null, cards: [] });
  assert.deepEqual(memSick(specs), []);
});

const VAULT = [
  root("pjaa", D(1)),
  card("aa01-有领域的卡", { domain: "域一", "born-at": D(5), label: "甲", parent: ["pjaa"] }),
  card("aa02-未分道的卡", { "born-at": D(6), label: "野", parent: ["pjaa"] }),
  card("cc01-parent写错的卡", { domain: "域一", "born-at": D(4), label: "散", parent: ["zz99"] }),
];

test("认主与上盘：唯一那张根卡是 model.center、不上盘；非根卡全部上盘不看 parent，无 domain 进未分道；day0 含诞生时刻", () => {
  const m = buildModel(memCards(VAULT));
  assert.equal(m.center?.id, "pjaa");
  assert.equal(m.center?.label, "测试项目");
  assert.deepEqual(m.cards.map((c) => c.id), ["cc01-parent写错的卡", "aa01-有领域的卡", "aa02-未分道的卡"]);
  /* 未分道哨兵：无 domain 卡归隐式组，排在 domains 末尾 */
  assert.equal(m.byId["aa02-未分道的卡"]?.domain, NO_DOMAIN);
  assert.deepEqual(m.domains, ["域一", NO_DOMAIN]);
  /* 根卡诞生早于首张卡：盘从项目诞生那天起算 */
  assert.equal(m.day0, dayNum(D(1)));
  assert.equal(m.dayMax, dayNum(D(6)));
});

test("只有根卡：空盘，盘界落在根卡诞生那天", () => {
  const m = buildModel(memCards([root("pjaa", D(3))]));
  assert.equal(m.center?.id, "pjaa");
  assert.deepEqual(m.cards, []);
  assert.equal(m.day0, dayNum(D(3)));
  assert.equal(m.dayMax, dayNum(D(3)));
});

test("根卡带里程碑：盘心带着它，落在盘时间范围内的进模型", () => {
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
  const input = memCards([root("pj01", D(1), { body }), card("aa01-内卡", { domain: "域一", "born-at": D(15) })]);
  assert.deepEqual(input.center?.milestones, [
    { date: "2026-01-10", name: "首座", desc: "第一座里程碑的说明。" },
    { date: "2026-01-20", name: "次座", desc: "" },
  ]);
  /* 盘的时间范围是 1 日到 15 日，20 日那座在范围外不画 */
  assert.deepEqual(buildModel(input).milestones.map((m) => m.name), ["首座"]);
});

test("根卡没这块即空列表", () => {
  const input = memCards([root("pj01", D(1), { body: "## 在做什么\n\n没里程碑。" })]);
  assert.deepEqual(input.center?.milestones, []);
});

test("字段写成别的形状报病、不替它转换：该写单个值的写成列表、parent 写成单个值；不再另报缺", () => {
  const specs = [
    root("pjaa", D(1)),
    card("aa01-形状不对", { label: ["甲", "乙"], domain: ["域一"], parent: "pjaa" }),
  ];
  assert.deepEqual(flatProblems(memSick(specs)), [
    { path: "aa01-形状不对.md", field: "parent", value: "pjaa", reason: "parent 须写成列表：parent: [根卡身份]" },
    { path: "aa01-形状不对.md", field: "domain", value: "域一", reason: "domain 须写成单个值，不是列表" },
    { path: "aa01-形状不对.md", field: "label", value: "甲,乙", reason: "label 须写成单个值，不是列表" },
  ]);
  /* 画得出来就照样画到盘上：短名改用文件名，分组归未分道 */
  const m = buildModel(memCards(specs));
  assert.deepEqual(m.cards.map((c) => [c.label, c.domain]), [["aa01-形状不对", NO_DOMAIN]]);
});

test("关系只能指向盘上的卡：指向根卡、指向不存在的卡、指向 born-at 写坏的卡都报病", () => {
  const specs = [
    root("pjaa", D(1)),
    card("aa01-甲", { parent: ["pjaa"] }),
    card("aa02-坏时刻", { parent: ["pjaa"], "born-at": "一月" }),
    card(
      "aa03-乱指",
      { parent: ["pjaa"], "born-at": D(3) },
      {
        body: [
          "pivots-from:: [项目](pjaa.md)",
          "supersedes:: [不存在](zz99-没有.md)",
          "pivots-from:: [坏时刻](aa02-坏时刻.md)",
          "supersedes:: [甲](aa01-甲.md)",
        ].join("\n"),
      },
    ),
  ];
  assert.deepEqual(
    flatProblems(scanSick(specs)).filter((p) => p.field === "relation"),
    [
      { path: "aa03-乱指.md", field: "relation", value: "pjaa", reason: "pivots-from:: 指向了根卡：根卡代表整个项目，关系要指向具体的卡" },
      { path: "aa03-乱指.md", field: "relation", value: "zz99-没有", reason: "supersedes:: 指向的卡不在盘上：没有这张卡，或它的 born-at 写坏了" },
      { path: "aa03-乱指.md", field: "relation", value: "aa02-坏时刻", reason: "pivots-from:: 指向的卡不在盘上：没有这张卡，或它的 born-at 写坏了" },
    ],
  );
  /* 报病不妨碍画到盘上，指得对的那条照常成边 */
  assert.deepEqual(buildModel(memCards(specs)).edges, [{ from: "aa01-甲", to: "aa03-乱指", kind: "supersede" }]);
});

test("根卡里程碑区块里以 - 开头却写坏的行报病", () => {
  const body = ["## 里程碑", "", "（只追加。日期｜标题｜说明）", "- 2026-01-10｜首座｜说明", "- 一月｜坏日期", "- 缺竖线"].join("\n");
  assert.deepEqual(flatProblems(memSick([root("pjaa", D(1), { body })])), [
    { path: "pjaa.md", field: "milestone", value: "- 一月｜坏日期", reason: "里程碑行须是「- 日期｜标题｜说明」，日期以 YYYY-MM-DD 开头" },
    { path: "pjaa.md", field: "milestone", value: "- 缺竖线", reason: "里程碑行须是「- 日期｜标题｜说明」，日期以 YYYY-MM-DD 开头" },
  ]);
  assert.deepEqual(memCards([root("pjaa", D(1), { body })]).center?.milestones.map((m) => m.name), ["首座"]);
});

test("buildModel 收到不合格的输入直接抛错，一次列全：身份重复、时刻写坏、关系种类不认识", () => {
  const good = { id: "a", bornAt: D(1), label: "甲", domain: null, kind: null, relations: [] };
  assert.throws(
    () =>
      buildModel({
        center: { id: "a", label: "盘心", bornAt: "2026/01/01", kind: "root", milestones: [] },
        cards: [
          good,
          { ...good, id: "b", bornAt: "一月二号" },
          { ...good, id: "c", relations: [{ kind: "replace" as "supersede", target: "a" }] },
        ],
      }),
    (err: Error) =>
      err.message.includes("身份「a」重复") &&
      err.message.includes("盘心「a」的 bornAt「2026/01/01」") &&
      err.message.includes("卡「b」的 bornAt「一月二号」") &&
      err.message.includes("卡「c」的关系种类「replace」不认识"),
  );
});

test("扫盘：目录不存在，回空集合，不报错、不建目录", async () => {
  assert.deepEqual(await scanCardDir("D:/这个目录不存在/也不该被建出来"), { center: null, cards: [], sick: [] });
});
