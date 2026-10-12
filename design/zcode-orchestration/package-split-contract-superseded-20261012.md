# 身份与评论拆包：第一批实现约定

> 2026-10-12 最新用户决定优先：docsite-comments 与 docsite-identity 无依赖，身份解析、授权和作者显示的组合由站点完成。下文旧首轮条款中要求评论包导入identity/Avatar/authorizeWrite的内容已被此条替代，仅留历史对照。评论包只接可信作者与评论业务数据，自己的作者归属规则仍服务端校验。实施细节见 prompts/K-host-composition.md。

用户已同意三运行时包＋建站包的目标结构，本批先实现 packages/docsite-identity 与 packages/docsite-comments，再串行接入 probes/261011_docsite-kit-complete/site。旧1.1仅probes可写的限制对本批两个新增包目录解除；其他旧生产文件仍不在首轮写入范围。

## 共同边界
- 同一仓，不新建仓，不提交/推送/发布，不抬旧包版本，不删旧实现。新包先private:true，版本由gwb-release规则和实际首次包情况处理，不推测已发布版本。
- 两包只用各自公开入口连接。comments不依赖docsite-kit、Fumadocs、Vite或React Router；站点负责集合、路由、正文渲染和布局。
- 根入口无Node/React副作用；/server只给Node；/react给浏览器；/styles.css为包自有样式。不得用跨包src相对路径或tsconfig paths伪造发布入口。
- 首轮不改仓根lock/workspace/package配置，不在父workspace执行install、不做整目录node_modules junction。安装与依赖解析由随后唯一集成会话串行完成；能运行的检查先运行，缺依赖则如实报待集成，不拿空测试或假模块代替。
- 不为拆包重写快照/评论磁盘格式或差分算法。2026-10-12 用户重申K-06：覆盖层属于当前待实现目标；K先完成运行时读写并释放目录，随后新建独立ZCode会话实现正文外悬浮标志。首轮仅搬迁旧定位不代表此项完成。
- Shared contract由主会话单写。实现方不改本文、不读取或修改对方未交付的文件；缺口写handoff给主会话。

## 身份包公开契约（给评论实现者）
根入口 @godcreator/docsite-identity:
- Person = { id:string; name:string; gitea?:string; agent?:boolean }，无codes。
- SiteIdentity = {person:Person;reason?:undefined}|{person:null;reason:string}。
- peopleFile='people.json'。
- personOf<T extends Person>(people:readonly T[],id:string):T。
- publicPersonOf(person:Person):Person：白名单投影，不能用对象展开把codes带入；publicPeopleOf(people:readonly Person[]):Person[]同理。
- mentionsOf(body:string,people:readonly Person[]):string[]。
- mentionBeingTyped(textBeforeCursor:string):{start:number;query:string}|null。
- peopleMatching<T extends Person>(people:readonly T[],query:string):T[]。

/server:
- StoredPerson = Person & {codes?:string[]}。
- parsePeople(value:unknown):StoredPerson[]；sitePeople(siteDir?:string):StoredPerson[]；peopleWithJoined沿用现有参数/磁盘规则。
- identityOf(people:readonly StoredPerson[],code:string|undefined):SiteIdentity；siteIdentity(siteDir?:string):SiteIdentity。身份由配置码决定，不看import.meta.env.DEV；公开结果和只读原因不得泄露码。
- identityCodeEnvName、identityCodePattern沿用当前真实约定（8～64位小写字母数字，不误写12位）。
- WriteAccessError extends Error {status:number}。
- authorizeWrite(request:Request, options:{identity:SiteIdentity;people:readonly Person[];as?:string|null;origin:string}):Person。
  origin由宿主可信配置传入完整origin；核对request的Origin精确匹配，缺失或不匹配403；无身份403；as省略用当前身份，as只允许已登记agent，未知400、冒充人403。不从请求body接收identity/origin。评论作者编辑/删除权限仍由评论包检查。
/react:
- Avatar({person,size?})、IdentityBadge({identity})，不带Fumadocs主题切换。

## 评论包接线
- 原comments.ts/comment-ranges.ts、server评论文件/请求与页面取字、browser锚点/展开、React评论界面及所需样式迁入本包，内部分目录，可按真实依赖调整小文件边界。
- 原server/siteIdentity、sitePeople迁到身份包，不再复制一套；主题切换属于站点。评论UI使用身份包Person/Avatar等公开入口。
- 保留可复用的commentRequestResponse、commentSourceResponse、commentSnapshotsOf、readCommentThreads、PageComments、AllComments等名字，补齐公开类型。
- CommentRequestOptions保留commenter、people、pageUrls、commentRoutes?、commentsDir?、pageHtmlOf?，新增必填siteOrigin:string；HTTP入口用identity/server authorizeWrite统一校验，旧actorOf逻辑不要再单独分叉。可信commenter由站点服务器身份解析提供。
- comment文件检查函数只检查评论，人员与页面存在校验由显式传入人员/页面信息完成；站点总体check由宿主组合。
- 评论UI正文以renderBody传入，不导入.source或站点组件表；评论链接协议与元数据适配留评论包，站点的通用链接组件接收其结果。
- 样式先保证原功能可用，声明自有tokens/defaults，避免强制Fumadocs布局/CSS变量。折叠适配与取字旧DOM假设如暂未替换必须记录，不假称已稳定。

## 完成流程
I身份包、J评论包各交付实际src、exports、必要行为回归测试、README和probes/261011_docsite-kit-complete/package-split/<identity|comments>/result.md、handoff.json。测试沿用现有有价值的人员/评论/请求/范围/取字用例；身份补充codes不出服务器、Origin/as的拒绝路径。
两个会话交回后主会话复核公开契约与实际文件，再新建K集成会话，串行安装/构建/类型检查/测试并改验证站，实际验证读评论、写回复、解决/重开和只读拒写；定位抽检既有collapse-test等价样本。K范围另派，未派前任何人不改站点或共享配置。


## 覆盖层验收约束（2026-10-12 用户重申）
评论数按钮、被批元素边框全部放在正文容器外的悬浮层；Range只读测量坐标。不得splitText、包裹正文、插入标记span/按钮、给正文元素写data-commented-element属性。CSS Custom Highlight可保留。滚动、换行、窗口/字体/图片尺寸变化、折叠展开后重算；正文节点身份、文本和子树结构应保持。默认覆盖层不拦正文交互，只有标志/卡片接收事件。运行时读写与覆盖层分两次交付，同文件串行交接。


