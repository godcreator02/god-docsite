/**
 * 正本到生成物的映射：一篇正本配几个落点，每个落点是同一段正文、加上点名的 frontmatter 字段。
 * 写出去的和核对的是同一段文字：两边都由 `planOutputs` 算。
 */
import { pickFrontmatter, withFrontmatter } from "./frontmatter.ts";
import { RenderRefusal, renderMachineMarkdown } from "./render.ts";
import type { MachineTextOptions } from "./render.ts";

/** 映射里的一个落点，对象写法：`to` 相对项目根；`frontmatter` 点名要原样带到生成物头部的字段 */
export interface OutputTarget {
  to: string;
  frontmatter?: string[];
}

/** 落点归一化之后的样子：字符串写法等于 `frontmatter: []` */
export interface OutputPlacement {
  to: string;
  frontmatter: string[];
}

/** 正本 → 落点数组的映射（使用方配置里写的那张表，值可以是字符串或 OutputTarget） */
export type OutputsConfig = Record<string, Array<string | OutputTarget>>;

/** 映射的两种落点写法归成一张表。形状不对当场报错——写错地方比不写更糟 */
export function placementsOf(outputs: OutputsConfig): Record<string, OutputPlacement[]> {
  const table: Record<string, OutputPlacement[]> = {};
  for (const [doc, targets] of Object.entries(outputs)) {
    if (!Array.isArray(targets) || targets.length === 0) throw new Error(`outputs 的 ${doc}：落点得是非空数组`);
    table[doc] = targets.map((raw) => {
      const target: OutputTarget = typeof raw === "string" ? { to: raw } : raw;
      if (typeof target !== "object" || target === null || typeof target.to !== "string" || target.to === "") {
        throw new Error(`outputs 的 ${doc}：每个落点得是非空的相对路径，或 { to, frontmatter? }`);
      }
      const frontmatter = target.frontmatter ?? [];
      if (!Array.isArray(frontmatter) || frontmatter.some((field) => typeof field !== "string" || field.trim() === "")) {
        throw new Error(`outputs 的 ${doc} → ${target.to}：frontmatter 得是字段名数组`);
      }
      return { to: target.to, frontmatter };
    });
  }
  return table;
}

/** 一个落点上该是什么：生成物全文；或者生成不了——源头部缺点名的字段，或源里有渲染不了的东西 */
export type OutputPlan =
  | { to: string; text: string }
  | { to: string; problem: "no-frontmatter"; missing: string[] }
  | { to: string; problem: "unrenderable"; reason: string };

/** 一篇正本在它各个落点上该是什么。正文只渲染一次；拒绝渲染（RenderRefusal）报成每个落点都 unrenderable，别的错照原样抛 */
export function planOutputs(source: string, placements: OutputPlacement[], options: MachineTextOptions): OutputPlan[] {
  let body: string;
  try {
    body = renderMachineMarkdown(source, options);
  } catch (err) {
    if (!(err instanceof RenderRefusal)) throw err;
    return placements.map(({ to }) => ({ to, problem: "unrenderable", reason: err.message }));
  }
  return placements.map(({ to, frontmatter }) => {
    const picked = pickFrontmatter(source, frontmatter);
    if (picked.missing.length > 0) return { to, problem: "no-frontmatter", missing: picked.missing };
    return { to, text: withFrontmatter(body, picked.lines) };
  });
}

/** 落点上那份跟该有的一样不一样：换行归一是「算不算同一份」的口径 */
export const sameOutput = (placed: string, expected: string): boolean => placed.replace(/\r\n/g, "\n") === expected;
