import path from 'node:path'
import { site } from '@/lib/site.server'
import { e2eDemoNotes } from '../../../.source/server'

/** 演示功能的上下文：从基础站点上下文组装；计数写在站点 data/ 里 */
export const demoSite = {
  counterFile: path.join(site.dir, 'data', 'e2e-demo-counter.json'),
  notes: e2eDemoNotes,
}
