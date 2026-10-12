import type { TermEntry } from '@probe/writing/compile'

/** 站点自己的术语表正本：source.config.ts（Node-only）读它建索引，浏览器端不加载 */
export const terms: TermEntry[] = [
  { term: '命令总线', def: '组件间传命令的一条通道，收发双方都只认这条通道。', href: '/docs/glossary-demo' },
  { term: '总线', def: '多台设备共用的一条传输线。' },
  { term: '隔离 home', def: '一套独立的环境：插件、端口、数据各自独立，验证东西不污染日常环境。' },
  { term: 'pane', def: '界面上的一个窗格。', aliases: ['panes'] },
]
