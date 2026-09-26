/**
 * 序列化模型的两头：服务端 buildTrajectory 出的是 SerializableModel（supersededIds 是数组，
 * 过得了 JSON），客户端组件吃的是 TrajectoryModel（Set）——这两个转换住一处，`.` 与 `./disk`
 * 两个入口共用。
 */

import type { TrajectoryModel } from "./types.ts";

/** TrajectoryModel 的可序列化版：supersededIds 从 Set 转数组，其余字段原样——
 * JSON.stringify（或跨进程传递）之前用这个。 */
export type SerializableModel = Omit<TrajectoryModel, "supersededIds"> & { supersededIds: string[] };

export function toSerializable(model: TrajectoryModel): SerializableModel {
  return { ...model, supersededIds: [...model.supersededIds] };
}

/** 序列化模型还原成运行期模型。 */
export function toRuntimeModel(serialized: SerializableModel): TrajectoryModel {
  return { ...serialized, supersededIds: new Set(serialized.supersededIds) };
}
