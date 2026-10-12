// 验证两个新包全部公开入口的运行时解析：按包目录解析（与真实宿主从 node_modules 消费一致），动态导入后核对关键导出存在。
// 在 docsite-kit 仓根用 node 运行：node probes/2610112023_docsite-kit-complete/package-split/integration/resolve-exports.mjs
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '../../../..')
const requireOf = (pkgDir) => createRequire(path.join(repoRoot, 'packages', pkgDir, 'package.json'))

const identityRequire = requireOf('docsite-identity')
const commentsRequire = requireOf('docsite-comments')

const targets = [
  ['identity', identityRequire, '@godcreator/docsite-identity', ['peopleFile', 'personOf', 'publicPersonOf', 'publicPeopleOf', 'mentionsOf', 'mentionBeingTyped', 'peopleMatching']],
  ['identity/server', identityRequire, '@godcreator/docsite-identity/server', ['parsePeople', 'sitePeople', 'peopleWithJoined', 'identityOf', 'siteIdentity', 'identityCodePattern', 'identityCodeEnvName', 'authorizeWrite', 'WriteAccessError']],
  ['identity/react', identityRequire, '@godcreator/docsite-identity/react', ['Avatar', 'IdentityBadge']],
  ['identity/styles.css', identityRequire, '@godcreator/docsite-identity/styles.css', null],
  ['comments', commentsRequire, '@godcreator/docsite-comments', ['commentFrontmatterSchema', 'commentThreadsOf', 'commentThreadsByPage', 'commentablePagesOf', 'assertCommentPagesExist', 'assertCommentAuthorsKnown', 'snapshotMismatchOf', 'diffOfTexts', 'commentLinkOf', 'linkedCommentParam']],
  ['comments/server', commentsRequire, '@godcreator/docsite-comments/server', ['commentRequestResponse', 'commentSourceResponse', 'commentSnapshotsOf', 'readCommentThreads', 'commentSiteProblems', 'commentThreadIdsAbout', 'pageTextOfHtml']],
  ['comments/browser', commentsRequire, '@godcreator/docsite-comments/browser', ['pageTextOf', 'rangeOfOffsets', 'offsetsOfRange', 'placeOfThread', 'elementKindOf', 'pickedElementOf']],
  ['comments/react', commentsRequire, '@godcreator/docsite-comments/react', ['PageComments', 'AllComments', 'commentScopeProps', 'CommentEditor', 'CommentItem', 'ThreadView', 'PeopleContext', 'postComment', 'rememberThreadToOpen', 'recentThreadToOpen']],
  ['comments/styles.css', commentsRequire, '@godcreator/docsite-comments/styles.css', null],
]

let failed = false
for (const [label, require, specifier, keys] of targets) {
  const resolved = require.resolve(specifier)
  if (keys === null) {
    console.log(`PASS ${label} -> ${resolved}`)
    continue
  }
  const module = await import(pathToFileURL(resolved).href)
  const missing = keys.filter((key) => !(key in module))
  if (missing.length > 0) {
    console.log(`FAIL ${label} -> ${resolved}：缺导出 ${missing.join('、')}`)
    failed = true
  } else {
    console.log(`PASS ${label} -> ${resolved}（${keys.length} 个导出齐全）`)
  }
}
if (failed) process.exit(1)
console.log('全部入口解析与导出核对通过')
