// 建站器生成，勿手改：addFeature / regenerateFeatureIndex 每次都重写。功能清单是 app/features/ 下含 routes.ts、feature.tsx 或 mdx.ts 的子目录
import { siteFeatureRuntime } from '@godcreator/god-docsite/react'
import * as collabFeature from './collab/feature.tsx'

export const featureRuntime = siteFeatureRuntime({ 'collab': collabFeature })
