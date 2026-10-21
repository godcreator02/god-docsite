/**
 * FeedSteps（「god-docsite：平台包」那一页「推送通道」一节）的全部数据，画面（feed-steps.tsx）只读这一份。
 * 令牌怎么给、怎么推、频道只留最新一份、浏览器怎么跟着变：gwb-docsite、站点进程（频道表）、浏览器三个方块，
 * 当前这一步经手的方块亮起、它们之间的箭头写这一步传的东西；右边一张卡片写这一步的真实内容。
 * 频道例子用 collab（协作站的通知整份推到这个频道，siteFeedChannel）；推送体 SiteFeed 的三个字段出自 collab 包的 site-feed.ts。
 * 令牌的值是拼的（每次启动 randomUUID 现生成）；启动行为概述自 gwb-docsite 的 dev-server.ts
 * （在站点目录 spawn pnpm dev，env 里带 feedTokenEnvName 给出的键），此处不逐字照抄。
 */

/** 左边竖排的三个方块（哪一步谁亮由每步的 active 与 flows 给出） */
export const actors = [
  { id: 'gwb', name: 'gwb-docsite' },
  { id: 'site', name: '站点进程', sub: '频道表' },
  { id: 'browser', name: '浏览器' },
];

/* ref file="../packages/god-docsite/src/core/feed.ts" lines="1-12" hash="d7c6b77ce97f" blob="8ecbf76d0f5b" */

/* ref file="../packages/god-docsite/src/site/feed.server.ts" lines="117-144" hash="9f730f433d5f" blob="d65574c716da" */

/** 第 3 步的频道表：站点进程里每个频道只留最新一份 */
/* ref file="../packages/god-docsite/src/site/feed.server.ts" lines="21-32" hash="abd786ebeea0" blob="4e60d11bac58" */

/** 第 4、5 步：loader 读初始值、浏览器订阅事件流 */
/* ref file="../packages/god-docsite/src/site/use-site-feed.ts" lines="1-12" hash="26a8047943b2" blob="6261f759a484" */

/** 第 5 步：一页的几个频道合成一条事件流，几个频道时 data 带上频道名 */
/* ref file="../packages/god-docsite/src/site/feed-client.ts" lines="75-87" hash="2e257a626f3a" blob="27c69dfbc069" */

/** 第 5 步的事件流：连上先发现在的值，之后每推一次发一次 */
/* ref file="../packages/god-docsite/src/site/feed.server.ts" lines="54-115" hash="633ce253e3f0" blob="d65574c716da" */

export const steps = [
  {
    title: '启动开发服务',
    text: 'gwb-docsite 在站点目录里运行 pnpm dev，环境变量里带上一个新令牌；令牌每次启动现生成，只在这一步交给站点进程，推送方自己留着另一份。',
    active: ['gwb', 'site'],
    flows: [{ from: 'gwb', to: 'site', label: '环境变量 DOCSITE_FEED_TOKEN' }],
    cardTitle: 'gwb-docsite 启动（站点目录）',
    lines: [
      { tone: 'none', text: 'pnpm dev' },
      { tone: 'none', text: 'env: { DOCSITE_FEED_TOKEN: 9a3f0c62-…（每次启动现生成） }' },
    ],
  },
  {
    title: '推一份 JSON',
    text: '推的一方 POST JSON 到频道的地址，请求头 x-docsite-token 带同一个令牌；成功 204（没有正文），令牌不对 403。',
    active: ['gwb', 'site'],
    flows: [{ from: 'gwb', to: 'site', label: 'POST /__docsite/feed/collab' }],
    cardTitle: '推送（POST）',
    lines: [
      { tone: 'none', text: 'POST /__docsite/feed/collab' },
      { tone: 'none', text: 'x-docsite-token: 9a3f0c62-…（同一个令牌）' },
      { tone: 'none', text: 'content-type: application/json' },
      { tone: 'none', text: '{ "notifications": [ … ], "aiPrompt": …, "projectLeads": … }' },
      { tone: 'good', text: '令牌对上 → 204' },
      { tone: 'bad', text: '令牌不对 → 403「x-docsite-token 不对」' },
      { tone: 'bad', text: '站点进程没有令牌 → 403「站点进程没有 DOCSITE_FEED_TOKEN：只有启动方给了令牌的站收推送」' },
    ],
  },
  {
    title: '频道只留最新一份',
    text: '站点进程里每个频道只留最新一份：再推一份，前一份就没了；新值同时发给所有订阅者。',
    active: ['site'],
    flows: [],
    cardTitle: '站点进程的频道表 latest',
    lines: [
      { tone: 'none', text: '推第一份：latest = { collab → 第一份 }' },
      { tone: 'none', text: '再推第二份：latest = { collab → 第二份 }' },
      { tone: 'good', text: '前一份没了——频道里只剩最新一份' },
    ],
  },
  {
    title: 'loader 读初始值',
    text: '页面的 loader 经站点上下文的 feedValue 读频道现在的值（没推过是 undefined），当作初始值交给浏览器——首屏不用等连接。',
    active: ['site', 'browser'],
    flows: [{ from: 'site', to: 'browser', label: 'loader 数据（首屏）' }],
    cardTitle: 'loader（渲染首屏）',
    lines: [
      { tone: 'none', text: "site.feedValue('collab')   // 没推过是 undefined" },
      { tone: 'none', text: '→ <第二份>，作为页面的初始值' },
    ],
  },
  {
    title: '浏览器订阅事件流',
    text: '浏览器 useSiteFeed(频道, 初始值) 订阅：一页里的几个频道合成一条事件流，连上先收到各频道现在的值，之后每次推送都收到，页面跟着变、不用刷新；页面隐藏时断开，重新显示时再连。',
    active: ['site', 'browser'],
    flows: [
      { from: 'browser', to: 'site', label: '连事件流（EventSource，一页一条）' },
      { from: 'site', to: 'browser', label: '先发现值，之后每次推送' },
    ],
    cardTitle: "useSiteFeed('collab') 与 useSiteFeed('collab-submit')",
    lines: [
      { tone: 'none', text: "new EventSource('/__docsite/feed/collab,collab-submit')" },
      { tone: 'none', text: '事件流：' },
      { tone: 'none', text: ': connected' },
      { tone: 'none', text: 'data: {"channel":"collab","data":<第二份>}   ← 连上先收到现在的值' },
      { tone: 'good', text: '之后每推一次：data: {"channel":频道,"data":<新的一份>}' },
      { tone: 'none', text: '页面隐藏 → 断开；重新显示 → 再连，先收到现在的值' },
    ],
  },
];
