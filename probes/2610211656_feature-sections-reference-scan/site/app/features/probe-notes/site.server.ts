import path from 'node:path'
import { site } from '@/lib/site.server'
import { fakeLibrary } from '@/probe-platform/fake-library.server'

export const notes = fakeLibrary({ dir: path.resolve(site.dir, '../library/notes'), component: 'Note', urlBase: 'notes', sectionName: '笔记', order: 20 })

export const references = notes.references
export const sections = notes.sections
