/**
 * 评论串的「复制给 AI」复制的提示词：只写找得到这一串要的东西（站点地址、页面、串 id）与被批的那一块，
 * 串里的发言由 AI 用 docsite.comments 现读，提示词里不抄。被批元素的文字只有浏览器量得到（元素 id 是浏览器按内容算的），所以由浏览器写进来
 */

/** 被批的那一块元素的文字超过这么多字就截断 */
const elementTextLimit = 1500

/** 批在哪，写给 AI 看 */
export type ThreadTargetForAi =
  | { kind: 'page' }
  | { kind: 'element'; text: string }
  | { kind: 'text'; quote: string; changed: boolean }
  /** 原文现在找不到或看不见：note 是界面上写给人看的那句 */
  | { kind: 'unplaced'; note: string }

export interface ThreadAiPromptInput {
  /** 站点的地址，如 http://127.0.0.1:41976/ */
  siteUrl: string
  /** 打开这一串的页面链接（带 ?comment=） */
  threadUrl: string
  /** 串头的 page 字段：docsite.comments 的 page 参数照写 */
  page: string
  threadId: string
  target: ThreadTargetForAi
}

function quoted(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

function targetLines(target: ThreadTargetForAi): string {
  switch (target.kind) {
    case 'page':
      return '- 批的是：整页'
    case 'element': {
      const text = target.text.length > elementTextLimit ? `${target.text.slice(0, elementTextLimit)}…（后面省略）` : target.text
      return `- 批的是页面上的这一块：\n\n${quoted(text)}`
    }
    case 'text':
      return `- 批的是这段字${target.changed ? '（批了以后原文改过，下面是批的时候的原文）' : ''}：\n\n${quoted(target.quote)}`
    case 'unplaced':
      return `- 批的位置：${target.note}`
  }
}

/** 评论串复制给 AI 的提示词 */
export function threadAiPromptOf({ siteUrl, threadUrl, page, threadId, target }: ThreadAiPromptInput): string {
  return `请回复站点上的一串评论。

- 站点地址：${siteUrl}
- 站点目录：调 gwb 的 docsite.site.list，取 url 是上面这个地址的那一项的 dir
- 页面：${page}
- 评论串：${threadId}
- 在网页上打开这一串：${threadUrl}
${targetLines(target)}

做法：

1. 调 docsite.comments {"dir": "<站点目录>", "page": "${page}"}，找到 id 是 ${threadId} 的那一串，读完串头和全部回复，弄清最后要回答的是什么
2. 读这一页的源文件（内容页在站点目录的 content/ 下）和它引用的代码、数据；问题涉及代码或数值的，能运行核实的先运行核实，不凭印象回答
3. 调 docsite.comment.reply {"dir": "<站点目录>", "thread": "${threadId}", "body": "<回复正文>", "as": "<站点 people.json 里 agent 为 true 的人员 id>"} 回复。用中文写；正文按 MDX 解析，尖括号、花括号放进行内代码或代码块里
4. 只回复：不改页面、不标为已解决。觉得页面该改，在回复里写明改哪里、怎么改，等人确认
`
}
