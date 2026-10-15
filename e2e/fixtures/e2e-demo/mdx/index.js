const markText = 'remark 演示标记'

function textOf(node) {
  return node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join('')
}

function markParagraphs(node) {
  if (node.type === 'paragraph' && textOf(node).includes(markText)) {
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, 'data-e2e-demo-remark': '' } }
  }
  for (const child of node.children ?? []) markParagraphs(child)
}

/** remark 插件：正文里写着「remark 演示标记」的段落带上 data-e2e-demo-remark 属性 */
export function remarkDemoMark() {
  return (tree) => markParagraphs(tree)
}
