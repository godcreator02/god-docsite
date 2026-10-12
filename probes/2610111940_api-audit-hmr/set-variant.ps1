param([ValidateSet('baseline','static','dynamic','restart','config')][string]$Variant='baseline')
$taskSite=Join-Path $PSScriptRoot 'site'
$source=Get-Content (Join-Path $PSScriptRoot 'fixtures/source.baseline.ts') -Raw
$config=Get-Content (Join-Path $PSScriptRoot 'fixtures/config.baseline.ts') -Raw
$vite=Get-Content (Join-Path $PSScriptRoot 'fixtures/vite.baseline.ts') -Raw
if ($Variant -in @('static','dynamic')) {
  $config="import { defineConfig } from 'fumadocs-mdx/config';`nexport default defineConfig({});"
  if ($Variant -eq 'static') {
    $source="import { applyMdxPreset } from 'fumadocs-mdx/config';`nimport { probeDep } from './probe-dep';`n"+$source
    $source=$source.Replace("async: true,", "async: true, mdxOptions: applyMdxPreset({ remarkPlugins: [probeDep] }),")
  } else {
    $source="import { applyMdxPreset } from 'fumadocs-mdx/config';`n"+$source
    $source=$source.Replace("async: true,", "async: true, mdxOptions: async () => { const { probeDep } = await import('./probe-dep'); return applyMdxPreset({ remarkPlugins: [probeDep] }); },")
  }
}
if ($Variant -eq 'restart') {
  $config=Get-Content (Join-Path $PSScriptRoot 'fixtures/config.collections.ts') -Raw
  $vite=$vite.Replace('probeDirWatch(), reactRouter()', 'probeDirWatch(), auditContentRestart(), reactRouter()')
  $vite += @'

function auditContentRestart(): Plugin {
  return {
    name: 'audit-public-restart',
    configureServer(server) {
      let pending: ReturnType<typeof setTimeout>;
      const onMembership = (file: string) => {
        const relative = file.replaceAll('\\', '/');
        if (!(relative.includes('/content/docs/') || relative.includes('/comments/'))) return;
        if (!relative.endsWith('.mdx')) return;
        clearTimeout(pending);
        pending = setTimeout(() => { console.log('[audit] public server.restart for', file); void server.restart().then(() => server.ws.send({ type: 'full-reload' })); }, 120);
      };
      server.watcher.on('add', onMembership);
      server.watcher.on('unlink', onMembership);
    },
  };
}
'@
}
if ($Variant -eq 'config') {
  $config += @'

import { defineDocs } from 'fumadocs-mdx/config';
import { auditNodePlugin } from './app/lib/audit-node-plugin';
export const auditA = defineDocs({ dir: 'content/audit-a', docs: { mdxOptions: applyMdxPreset({ remarkPlugins: [[auditNodePlugin, { marker: 'A-ONLY-NODE-COMPILED' }]] }) } });
export const auditB = defineDocs({ dir: 'content/audit-b', docs: { mdxOptions: applyMdxPreset({ remarkPlugins: [] }) } });
'@
}
Set-Content (Join-Path $taskSite 'app/lib/source.ts') $source
Set-Content (Join-Path $taskSite 'source.config.ts') $config
Set-Content (Join-Path $taskSite 'vite.config.ts') $vite
