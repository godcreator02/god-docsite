$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node ./render-baseline.mjs *> ./out/baseline.log
if ($LASTEXITCODE -ne 0) { throw 'baseline failed; see out/baseline.log' }
$auditPages = @('audit-flow.mdx','audit-inline.mdx','audit-fence.mdx','audit-inlinecode.mdx','audit-nested.mdx','audit-good-nested.mdx','audit-missing.mdx','audit-alias.mdx','audit-produced-inline.mdx','audit-produced-raw.mdx','audit-throw-before.mdx','audit-throw-after.mdx','audit-term.mdx','audit-pin-same.mdx','audit-pin-position.mdx','audit-pin-no-position.mdx','audit-pin-second.mdx','audit-pin-search-record.mdx','e8.mdx','audit-assets.mdx','audit-pin-tree.mdx','audit-lower-alias.mdx','audit-member.mdx','audit-html-container.mdx','audit-pin-lowcoupling.mdx')
node ./render-audit.mjs @auditPages *> ./out/audit.log
if ($LASTEXITCODE -ne 0) { throw 'audit failed; see out/audit.log' }
node ./verify-results.mjs
if ($LASTEXITCODE -ne 0) { throw 'verification failed' }
node ./environment.mjs *> ./out/environment.log
if ($LASTEXITCODE -ne 0) { throw 'environment inventory failed' }
