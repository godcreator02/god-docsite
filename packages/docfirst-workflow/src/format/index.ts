/**
 * 命令行要的格式接口：钉码的 `Format` 再加两样可选的本事——名册检查与按原文渲染。
 *
 * 这两样不是钉码的事：钉码只管认引用、判新鲜、写回记录，所以 `@godcreator/docfirst-pin` 的
 * `Format` 只有四个方法；check 要查名册外组件、render 要把生成正本渲成 md，是命令行与项目的需要，
 * 接口就定在这儿。一个格式只实现钉码那四样也能挂进项目：只核对、不查名册、不渲染。
 *
 * 这个目录只认识 `@godcreator/docfirst-pin`，不认识 mdx / project / cli（`tests/boundary.test.ts` 守着）。
 */
import type { Format, Listing } from "@godcreator/docfirst-pin";

export interface DocFormat extends Format {
  /** 名册外组件，给命令行 check 用；roster 是项目 docfirst.config 里声明的组件名册 */
  lintComponents?(text: string, roster?: unknown): Array<{ name: string; line: number }>;
  /** 渲染：按原文出一份给 AI 读的 md，记号换成清单里今天的内容。正本里有渲染不了的东西时抛 RenderRefusal */
  renderAi?(text: string, listing: Listing): string;
}

/** renderAi 拒绝渲染（草稿记号、缺失的引用、组件、mdx 表达式）时抛它；摆放按这一类把它报成红，别的错照原样抛 */
export class RenderRefusal extends Error {
  override name = "RenderRefusal";
}

/** 认名字不认 instanceof：格式与宿主可能各从一份产物加载，拿到的不是同一个类 */
export const isRenderRefusal = (err: unknown): err is RenderRefusal => err instanceof Error && err.name === "RenderRefusal";
