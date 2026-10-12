/** 浏览器端（无 React）：在页面 DOM 上算页面文字、换算评论批的位置。规则与 src/page-text-rules.ts 一致，服务端解析 HTML 的等价实现在 ./server */

export {
  anchorLabelOf,
  commentUiAttribute,
  elementKindOf,
  elementLabelOf,
  elementOffsetsOf,
  offsetsOfRange,
  openerLabelOf,
  openerRangesOf,
  pageTextOf,
  pickedElementOf,
  placeOfThread,
  rangeOfOffsets,
  type PageText,
  type ThreadPlace,
} from './comment-anchors.js'
