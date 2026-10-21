/**
 * IdentitySeams（「identity：身份」那一页开头之后的总图）的内容：身份码从哪来、名单在哪、站点怎么认人、谁在写入前核对。
 * 坐标与图标在 seams.tsx 的 SeamLayout 里，这里只有内容；能力名与标识符都以代码里的导出名为准。
 * core 层的名单校验与加入（parsePeople · peopleWithJoined）、按码认人（identityOf）没有跨模块的接缝：
 * 它们由包内 node 层调用（sitePeople / joinSitePeople 调名单校验与加入，siteIdentity 调按码认人）。
 * 本页后面各节开头按接缝编号引用这张图。
 */
import { defineSeamGraph } from '@godcreator/explainer';

export const identitySeams = defineSeamGraph({
  id: 'identity-seams',
  title: 'identity 包的接缝图',
  intro:
    '左列是 gwb 插件 gwb-docsite（身份码由它生成与保管），中列是站点目录里的名单 people.json，中间是 identity 包的七项能力，右列是用它的两方：平台模板与 comments、collab 的写入 action。',
  frameLabel: '模块',
  modules: [
    {
      id: 'gwb-docsite',
      name: 'gwb-docsite',
      pkg: 'plugins/docsite',
      role: 'cyan',
      outside: false,
      blurb: '身份码在本 home 第一次加载时生成、存在设置 identity-code 里；把自己加进名单走它的命令 docsite.people.join，站点起来后把码放进托管方上下文推给站点。它自己怎么用归插件的页。',
      caps: [
        { id: 'code', name: '保管本 home 的身份码', ident: '设置 identity-code' },
        { id: 'join', name: '加进名单的命令', ident: 'docsite.people.join' },
        { id: 'launch', name: '推托管方上下文', ident: 'host.identityCode' },
      ],
    },
    {
      id: 'site-dir',
      name: '站点目录',
      pkg: '站点根目录',
      role: null,
      outside: true,
      blurb: '名单就是站点根目录里的 people.json，跟页面一起进 git。',
      caps: [{ id: 'people-file', name: '人员名单', ident: 'people.json' }],
    },
    {
      id: 'identity',
      name: 'identity 包',
      pkg: '@godcreator/identity',
      role: 'emerald',
      outside: false,
      blurb: 'core 层定名单的校验与加入、按码认人、公开投影与写入前核对，被包内 node 层调用；node 层读写 people.json、按运行方式与交来的身份码认本机身份；site 层是交给页面的界面。',
      caps: [
        { id: 'parse', name: 'core 名单校验与加入', ident: 'parsePeople · peopleWithJoined' },
        { id: 'join-node', name: 'node 加入名单', ident: 'joinSitePeople' },
        { id: 'read', name: 'node 读名单与本机身份', ident: 'sitePeople · siteIdentity' },
        { id: 'recognize', name: 'core 按码认人', ident: 'identityOf' },
        { id: 'authorize', name: 'core 写入前核对', ident: 'authorizeWrite' },
        { id: 'public', name: 'core 公开投影', ident: 'publicPeopleOf' },
        { id: 'ui', name: 'site 界面', ident: 'IdentityProvider · IdentityBadge · Avatar' },
      ],
    },
    {
      id: 'platform',
      name: '平台模板',
      pkg: 'god-docsite',
      role: 'amber',
      outside: false,
      blurb: '平台包 god-docsite 写进每个站点的接线文件：site.server.ts 每次请求现取本机身份与名单，布局路由把名单投影成公开形状交给界面。',
      caps: [
        { id: 'platform-layout', name: '布局路由', ident: 'layout.tsx' },
        { id: 'platform-server', name: '站点模板', ident: 'site.server.ts' },
      ],
    },
    {
      id: 'writers',
      name: 'comments 与 collab',
      pkg: '功能包',
      role: 'violet',
      outside: false,
      blurb: '评论与任务的写入 action 都先经写入前核对（authorizeWrite），过了才以认出的身份写。',
      caps: [{ id: 'writers', name: '写入 action', ident: 'comments · collab' }],
    },
  ],
  entries: [],
  seams: [
    {
      n: 1,
      name: '加进名单',
      a: ['join'],
      b: ['join-node'],
      iface: 'docsite.people.join { dir, id, name, gitea? } → joinSitePeople(siteDir, code, joining)',
      convention: false,
      via: 'code',
      text: 'join 命令带来 id、名字（可选 gitea），码取本 home 设置里的身份码，一起交给本包 node 层的 joinSitePeople。',
    },
    {
      n: 2,
      name: '写回名单',
      a: ['join-node'],
      b: ['people-file'],
      iface: 'joinSitePeople → writeSitePeople，一项一行写回 people.json',
      convention: false,
      via: 'disk',
      text: '写回时一项一行：加一个人或一个码，git 里的改动只有那一行；码本来就在这个人名下时不写文件。',
    },
    {
      n: 3,
      name: '现读名单',
      a: ['read'],
      b: ['people-file'],
      iface: 'sitePeople(siteDir) → StoredPerson[]',
      convention: false,
      via: 'disk',
      text: '名单每次都重新读，改了不用重启开发服务。',
    },
    {
      n: 4,
      name: '身份码交给站点进程',
      a: ['launch'],
      b: ['read'],
      iface: '频道 host 的 identityCode → siteIdentity(siteDir, mode, identityCode)',
      convention: false,
      via: 'code',
      text: 'gwb-docsite 把本 home 的码放进托管方上下文推进频道 host，站点模板取出来交给 siteIdentity 在名单里找人；发布版（start）不看码，一律只读。',
    },
    {
      n: 5,
      name: '平台模板接线',
      a: ['platform-server', 'platform-layout'],
      b: ['read', 'public', 'ui'],
      iface: 'siteIdentity(dir, mode) · sitePeople(dir) · publicPeopleWithAvatars(dir, people) · IdentityProvider / IdentityBadge',
      convention: false,
      via: 'code',
      text: 'site.server.ts 每次请求现取本机身份与名单；布局路由把名单经 publicPeopleWithAvatars 投影成公开形状、补上头像地址，交给 IdentityProvider，侧栏底部放 IdentityBadge。',
    },
    {
      n: 6,
      name: '写入前核对',
      a: ['writers'],
      b: ['authorize'],
      iface: 'authorizeWrite(request, { identity, people, as, origin }) → PublicPerson',
      convention: false,
      via: 'code',
      text: 'comments 与 collab 的写入 action 都先过 authorizeWrite（Origin 头、本机身份、as），过了才以认出的身份写。',
    },
  ],
});
