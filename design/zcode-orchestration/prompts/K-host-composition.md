用户新增并明确确认包边界：评论包不应该知道身份包存在，二者组合全部由站点完成。请在当前同一写入范围、同一会话内把这个边界一起收敛；不再按旧contract里“comments依赖identity”的条款实现，它已由本指令替代。先完成运行时读写及本次解耦再交回，覆盖层仍交给后续独立会话，别并行碰同文件。

具体最小边界：
1. docsite-comments package.json、src、公开types、浏览器/服务端入口中都不得依赖或导入docsite-identity（也不要藏成peer/动态import）。不要新增公共类型包/依赖注入框架。
2. 评论包自有最小作者/参与者结构（如{id,name,...确实需要的显示字段}），只认识作者ID、评论的作者归属、显式传入的可写状态/作者信息；站点将身份结果投影后传入。编辑/删除必须是评论作者的业务规则仍在评论服务端执行，不能只靠UI。
3. 身份码、siteIdentity/sitePeople、Origin校验、as代理身份解析与授权，都由站点HTTP路由先调用identity公开接口完成，再把可信actor传给评论处理。评论处理不得从不可信form字段自行决定actor；不得因拆开而遗漏只读/Origin/as拒写。不要照搬身份逻辑进评论包。
4. Avatar/身份徽章等站点组合：评论UI可接一个简单renderAuthor/renderAvatar插槽，或用自有最小作者显示默认值，站点要用identity的Avatar则由站点传入；不在评论包import identity/react。@提及的编辑/过滤/正文匹配属于评论语义，所需纯函数放评论包自己；保留identity旧导出兼容，不为本次删旧包API。评论校验错误也不要硬编码people.json为身份来源，参与者名单由宿主给。
5. 两边测试分清：评论包测试可信actor的评论行为/归属规则；站点集成测试身份+Origin+as+只读组合，验证403/400与不改盘。身份包自己已有测试不丢。全Vitest。
6. packages/readme/契约说明写实际边界；新依赖声明变化每次先读gwb-release。仅本批新包workspace importer/本站lock必要变更，不升级旧包/无关依赖、不提交发布。

用户要求的是更简单的组合关系，避免为了这次再加一层“大统一认证抽象”。实际文件仍由你独占，L已交回并验收，主会话单写台账。把这项与runtime刷新一起交付后释放React/browser文件给覆盖层任务。
