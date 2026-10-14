/**
 * trajectory：读轨迹卡目录、建星轨盘的模型，打印根卡、卡数与每棵树的主干；`--json` 输出盘的输入（盘心、卡、病卡）与树。
 * 只要配置，不装配项目：它不遍历文档。
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildModel } from "@godcreator/trajectory";
import { scanCardDir } from "@godcreator/trajectory/node";
import type { DocfirstConfig } from "../config.ts";

export async function trajectoryCommand(root: string, config: DocfirstConfig, json: boolean): Promise<number> {
  const dir = join(root, config.trajectoryDir);
  if (!existsSync(dir)) {
    console.error(`这个项目还没有轨迹卡目录 ${config.trajectoryDir}（相对项目根；位置由配置的 trajectory 定，不写是内容根下的 trajectory/）`);
    return 2;
  }
  const scan = await scanCardDir(dir);
  const model = buildModel(scan);
  if (json) {
    console.log(JSON.stringify({ ...scan, trees: model.trees }));
    return 0;
  }
  const rootText = model.center ? `${model.center.label}（${model.center.id}）` : "没认出根卡（卡目录里根卡不是恰好一张，见 docfirst check）";
  console.log(`盘 ${rootText}  ${model.cards.length} 张卡`);
  for (const tree of model.trees) console.log(`  主干：${tree.spine.join(" → ")}`);
  const sublineCount = model.trees.reduce((n, t) => n + t.sublines.length, 0);
  console.log(`  支线 ${sublineCount} 条，孤星 ${model.isolated.length} 张`);
  return 0;
}
