/**
 * @godcreator/docfirst-trajectory——`.` 入口：建模与类型。下游把一张盘（盘心加一组卡）送进 buildModel，
 * 拿回布局要的模型；卡从哪儿来、怎么写、怎么校验归下游。一句 import 外部模块都没有，浏览器、服务端、命令行都能直接用。
 * 客户端组件 StarDisk 在 `./disk` 入口，它自己建模、算布局。
 */

export { buildModel, validBornAt } from "./model/build.ts";
export type {
  BrokenRel,
  Card,
  DiskCard,
  DiskCenter,
  DiskInput,
  Edge,
  EdgeKind,
  Milestone,
  Relation,
  TrajectoryModel,
  Tree,
} from "./model/types.ts";
