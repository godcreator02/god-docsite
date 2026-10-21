// 原型：手写的汇总文件，模拟建站器把各功能导出了 sections 的 site.server.ts 登记进来
import type { ReferenceResolver, SiteReferences } from '@/probe-platform/references.server'
import type { SiteSection } from '@/probe-platform/sections'
import * as probeNotesServer from './probe-notes/site.server.ts'
import * as probePapersServer from './probe-papers/site.server.ts'

interface FeatureServerModule {
  references?: ReferenceResolver
  sections?(references: SiteReferences): SiteSection[]
}

export const featureServers: Record<string, FeatureServerModule> = { 'probe-notes': probeNotesServer, 'probe-papers': probePapersServer }
