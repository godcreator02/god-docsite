/**
 * SiteRoutes（「collab：项目协作」那一页「站点上」一节）的全部数据，画面（site-routes.tsx）只读这一份。
 * 站点上的数据只走三条路：读（每次请求现读 collab/）、写（只经 action）、通知（gwb-collab 推来的 SiteFeed）；
 * 每条路画成从上到下的一串卡片，每张卡写这个环节手里的真实东西。站点自己不跑 git。
 */

/** 每种情况末尾那行灰字 */
export const footer = '站点自己不跑 git，提交审核归 gwb-collab。';

export const cases = [
  {
    id: 'read',
    label: '打开任务页',
    text: '打开任务页就是一次普通的读：路由对上 /tasks，loader 从磁盘现读一遍记录与人员列表，页面照着画。没有缓存层——记录、人员、页面改了，下一次请求就看得见，不用重启服务。',
    chain: [
      { title: '浏览器', lines: ['GET /tasks'] },
      { title: '路由', lines: ["template/routes.ts：route('tasks', './tasks.tsx')"] },
      { title: 'loader', lines: ['readCollabSnapshot(repoDir)', '现读 collab/records/ 下每个文件与 site/people.json'] },
      { title: '页面', lines: ['任务与模块照刚读到的快照画出来'] },
    ],
  },
  {
    id: 'write',
    label: '改一条任务',
    text: '写只走这一条路：表单交给 action，写入规则判过谁能改什么，node 层照计划落盘。站点不跑 git——改动留在各人本机的协作仓里，经 git 同步给别人。',
    chain: [
      { title: '表单', lines: ['intent=update-record · id · field · value'] },
      { title: 'action', lines: ['来源与身份核对：Origin 等于可信 origin、身份码认人', '不对回 403'] },
      { title: '写入规则', lines: ['planUpdate 判谁能改哪些字段（上一节那五步）'] },
      { title: '写文件', lines: ['照计划改写 collab/records/<id>.json', '回 200 { ok: true }；被写入规则拒绝回 422 { ok: false, error }'] },
    ],
  },
  {
    id: 'notify',
    label: '来了一条通知',
    text: '通知不是站点自己算的：gwb-collab 算好整份 SiteFeed（通知、交给 AI 的提示词、项目负责人）推过来，站点只收不发。推来的是外部输入，siteFeedOf 按形状逐项查，不对就抛 InvalidSiteFeed。',
    chain: [
      { title: 'gwb-collab', lines: ['算出整份 SiteFeed { notifications, aiPrompt, projectLeads }'] },
      { title: "gwb-docsite 的 push", lines: ["push(siteDir, 'collab', feed)：推到站点推送通道的频道 collab"] },
      { title: '站点的推送通道', lines: ['收到推来的新值（服务端启动时就有这条连接）'] },
      { title: '布局顶部的通知栏', lines: ['useSiteFeed 跟着变：首屏用布局数据里的，连上通道后跟着推来的走'] },
    ],
  },
];
