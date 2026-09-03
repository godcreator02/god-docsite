# greet 用法（纯 md）

同一份代码，换一种文档格式。md 的记号是一条 html 注释，下面跟一段围栏当展示区，再一条尾注释收口。

<!-- ref file="src/greet.ts" lines="2-3" -->
```ts
export function greet(name: string): string {
  return `hello ${name}`;
```
<!-- /ref -->

围栏里那段代码是 `livedoc confirm` 投影进去的**派生缓存**，不是记忆——记忆在 `.ledger.json` 里。
手改围栏里的字不会让状态变黄；改 `src/greet.ts` 才会。

## 这个项目没用 git 记忆

`livedoc.config.mjs` 里把比较器换成了 `hash`：只记段哈希，不问 git，也不跟行段。
代价是代码往下挪几行它就报「有变动」，说不出挪到哪儿了，也拿不回旧内容。
换回 `git` 只要改那一行——旧记录的 `kind` 对不上，一律当「未确认」重新确认一遍，不猜。
