/**
 * 序列化模型的两头：服务端 buildTrajectory 出的是 SerializableModel（supersededIds 是数组，
 * 过得了 JSON），客户端组件与服务端定妆照画家吃的是 TrajectoryModel（Set）——这两个转换
 * 与「空盘兜底」住一处，`./react` 与 `./server` 两个入口共用。不经 index.ts 的桶（那儿链到
 * node:fs），这个文件本身零 import。
 */

import type { TrajectoryModel } from "./types.ts";

/** TrajectoryModel 的可序列化版：supersededIds 从 Set 转数组，其余字段原样——
 * JSON.stringify（或跨进程传递）之前用这个。 */
export type SerializableModel = Omit<TrajectoryModel, "supersededIds"> & { supersededIds: string[] };

export function toSerializable(model: TrajectoryModel): SerializableModel {
  return { ...model, supersededIds: [...model.supersededIds] };
}

/** 空盘兜底模型：一张卡都没有的项目（或整个轨迹目录还没有任何卡）时喂给 RingsLayout，
 * 盘心画得出、其余环照常画，只是没有任何节点。 */
export function emptyModel(): TrajectoryModel {
  const today = Math.floor(Date.now() / 86400000);
  return {
    root: null,
    cards: [],
    wormholes: [],
    edges: [],
    broken: [],
    dupes: [],
    supersededIds: new Set(),
    domains: [],
    byId: {},
    trees: [],
    isolated: [],
    compOf: {},
    day0: today,
    dayMax: today,
  };
}

/** 序列化模型还原成运行期模型；没有（盘不存在）就是空盘。 */
export function toRuntimeModel(serialized: SerializableModel | undefined): TrajectoryModel {
  if (!serialized) return emptyModel();
  return { ...serialized, supersededIds: new Set(serialized.supersededIds) };
}
