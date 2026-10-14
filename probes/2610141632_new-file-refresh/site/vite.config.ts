import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { probeDiagnostics } from './plugins/probe-diagnostics.ts'
import { rewriteRelativeGlobBase } from './plugins/rewrite-relative-glob-base.ts'
import { invalidateCollectionsOnAddOrRemove } from './plugins/invalidate-collections.ts'
import { restartOnContentAddOrRemove } from './plugins/restart-on-content-add.ts'

const contentDirs = ['content/docs', 'journal', 'comments']

const collectionFiles = ['.source/server.ts', '.source/browser.ts', 'app/lib/journal.ts']

// PROBE_FIX 选修复方式：none（原版或 vite 补丁版）、rewrite（方案 B）、hotupdate（方案 C）、
// hotupdate-reload（方案 C 加浏览器整页刷新）、restart（方案 D2）
const fixPlugins: Record<string, Plugin[]> = {
  'none': [],
  'rewrite': [rewriteRelativeGlobBase()],
  'hotupdate': [invalidateCollectionsOnAddOrRemove({ collectionFiles, contentDirs })],
  'hotupdate-reload': [invalidateCollectionsOnAddOrRemove({ collectionFiles, contentDirs, reloadClient: true })],
  'restart': [restartOnContentAddOrRemove({ contentDirs })],
}
const fix = process.env.PROBE_FIX ?? 'none'
if (!(fix in fixPlugins)) throw new Error(`PROBE_FIX 只能是 ${Object.keys(fixPlugins).join('、')}，收到 ${fix}`)

export default defineConfig({
  plugins: [fumadocsMdx(), ...fixPlugins[fix]!, probeDiagnostics({ contentDirs }), tailwindcss(), reactRouter()],
})
