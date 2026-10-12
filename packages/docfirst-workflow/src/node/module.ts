import { pathToFileURL } from "node:url";

/** 由 Node 原生加载一个模块文件，交回它的 default 导出（不校验形状） */
export async function importDefault(path: string): Promise<unknown> {
  // 被加载的是消费方项目里的活模块，必须由 Node 原生加载：站的打包器会把动态 import 改写成
  // 它自己的加载器，两个标记让它绕开这一句（turbopack / webpack 各认一个）
  const url = pathToFileURL(path).href;
  return ((await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ url)) as { default: unknown }).default;
}
