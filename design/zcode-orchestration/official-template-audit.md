# 官方模板与当前实验的区别

2026-10-12。用户要求先核对官方说法，暂不继续加实现。

## 已核对的官方材料

- 官方仓dev提交 d6cfc48d62aa9ea413f0fc5033617c0c923681ec（2026-10-09）。该提交packages/mdx/package.json版本15.4.7，与当前probe一致。
- packages/create-app/scripts/sync.ts 把 examples/react-router 同步为CLI的react-router模板；react-router-min是另一个官方最小示例。两者正文接线均为Macro API。
- examples/react-router/vite.config.ts：fumadocsMdx()、tailwindcss()、reactRouter()，无自建热更新插件，无index.target覆盖。
- app/lib/source.ts：从fumadocs-mdx/macro导入defineDocs，async docs集合，loader转为source。
- app/routes/docs.tsx：服务端loader交path/pageTree；Content调用docs.getPage(path)，use(page.load())读toc，直接渲染page.body；不自己创建createClientLoader包装。
- 官方Vite文档、Macro文档采用此路线；Config API仍是官方公开文档用法，不能因不同于当前模板就宣称废弃或错误。

链接：
- https://www.fumadocs.dev/docs/mdx/vite
- https://www.fumadocs.dev/docs/mdx/macro
- https://www.fumadocs.dev/docs/mdx/collections
- https://github.com/fuma-nama/fumadocs/blob/d6cfc48d62aa9ea413f0fc5033617c0c923681ec/examples/react-router/app/routes/docs.tsx
- https://github.com/fuma-nama/fumadocs/blob/d6cfc48d62aa9ea413f0fc5033617c0c923681ec/packages/create-app/scripts/sync.ts

## 当前N/S实验

使用Config API定义集合、生成.source/server与browser、createClientLoader/useContent；S另加raw入口预查。为对照覆盖过index.target。不是原样CLI模板，也不是官方Macro示例的等价实测。

没有自建完整HMR系统：当前接入的是Vite、React Router、fumadocs-mdx内置更新机制。我们写的是评论文件增删、路由数据读取、正文包装与准备/错误状态。旧hot.data/store/touch/delete过滤等试验不属于当前S新增正文基线的实现；评论完整更新闭环尚未验收。

## 已知不妥与结论边界

1. 未先原样跑官方模板，就称自拼probe为标准基线，口径不准确。既有默认Config接线新增404和正文状态重置实测有效，但不能外推到官方Macro模板。
2. S的Math.random身份探针造成SSR hydration属性警告，不能把全程console说成零错误。
3. S的countPages只处理folder/page，传Root时返回0，data-nav-count不可信；主会话验收依据实际导航链接及HTTP状态，因此核心结果不依赖该计数。
4. S的useMemo(load)+use(promise)替代正文加载实验存在未解决异常，不能据此定性Fumadocs编译出的组件错误。它也不是官方Macro示例里的use(page.load())。
5. “SSR模块HMR必然整路由remount”已被外壳state/草稿保留的对照否定；“没有公开入口查询”错误，raw为公开入口。
6. index.target=default虽见于公开类型，却不是官网默认模板配置，不把它叫官方推荐修复。

下一步应原样保留官方Macro模板作为对照，再复测新增/交互。这里只核对代码与文档，未宣称官方模板已实跑通过，未擅自改掉现有Config API架构或继续派实现。
