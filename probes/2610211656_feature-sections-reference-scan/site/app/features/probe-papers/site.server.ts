import path from 'node:path'
import { site } from '@/lib/site.server'
import { fakeLibrary } from '@/probe-platform/fake-library.server'

export const papers = fakeLibrary({ dir: path.resolve(site.dir, '../library/papers'), component: 'Ref', urlBase: 'refs', sectionName: '论文', order: 10 })

export const references = papers.references
export const sections = papers.sections
