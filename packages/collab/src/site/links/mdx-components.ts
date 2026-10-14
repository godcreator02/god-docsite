import { JournalLink, RecordLink } from './record-link.js'
import { RepoLink } from './repo-link.js'

/** MDX 页面（内容页与日志页）不用 import 就能写的组件，也是 remarkCollabLinks 换上去的组件：站点把它并进 MDX 的组件表 */
export const collabMdxComponents = { RecordLink, JournalLink, RepoLink }
