/**
 * 评论包的浏览器侧入口：页面文字序列化与位置换算、快照差异重定位、可批元素标注走查、落点推算。
 * 全部只读正文（标注走查只往候选元素上加属性），不改文字、不碰编译链
 */
export { atomicCharacter, commentScopeAttribute, offsetsOfRange, pageTextOf, pageTextRoleOf, rangeOfOffsets, readablePageText, type PageText, type PageTextRole } from './page-text.js'
export { createRangeMapper, diffOfTexts, mapRangeThroughDiff, type MappedRange, type RangeMapper, type TextOffsetRange } from './range-mapping.js'
export { annotateCommentTargets, commentTargetAttribute, commentTargetLabelOf, commentTargetNear } from './annotate.js'
export { targetOfThread, type ThreadTarget } from './thread-target.js'
