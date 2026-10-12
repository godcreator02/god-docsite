import { describe, expect, it } from 'vitest'
import { annotateCommentTargets, commentTargetAttribute, commentTargetLabelOf, commentTargetNear } from '../src/browser/annotate.js'
import { offsetsOfRange, pageTextOf, rangeOfOffsets, readablePageText } from '../src/browser/page-text.js'
import { targetOfThread } from '../src/browser/thread-target.js'
import { createRangeMapper } from '../src/browser/range-mapping.js'

/** 一个正文容器的样例：标题带自己的 id，两段文字，一张图片（原子字） */
function sampleScope() {
  const scope = document.createElement('div')
  scope.setAttribute('data-comment-scope', '')
  scope.innerHTML = [
    '<h2 id="自己的标题">标题文字</h2>',
    '<p>第一段话，<em>着重</em>的部分。</p>',
    '<p>第二段话。</p>',
    '<p><img src="/x/y.png" alt="图" />后面还有字</p>',
    '<span class="sr-only">只给读屏看的字</span>',
  ].join('')
  return scope
}

describe('页面文字（DOM 折叠成字符串）', () => {
  it('文字节点顺序拼接，图片记成一个原子字，sr-only 不算', () => {
    const pageText = pageTextOf(sampleScope())
    const expected = '标题文字' + '第一段话，' + '着重' + '的部分。' + '第二段话。' + '￼' + '后面还有字'
    expect(pageText.text).toBe(expected)
    expect(readablePageText('a￼b')).toBe('a b')
  })

  it('位置与 DOM 范围来回换算，选中一段字得到位置', () => {
    const scope = sampleScope()
    const pageText = pageTextOf(scope)
    const p2 = scope.querySelectorAll('p')[1]!
    const range = document.createRange()
    range.selectNodeContents(p2)
    expect(offsetsOfRange(pageText, range)).toEqual([pageText.text.indexOf('第二段话'), pageText.text.indexOf('第二段话') + 5])
    const back = rangeOfOffsets(pageText, 0, 2)
    expect(back.toString()).toBe('标题')
  })
})

describe('可批元素标注走查（按块批注的认定协议）', () => {
  it('候选元素标 data-comment-target，没有 id 的按内容指纹分配，标题保留自己的 id', () => {
    const scope = sampleScope()
    annotateCommentTargets(scope)
    const heading = scope.querySelector('h2')!
    const firstP = scope.querySelectorAll('p')[0]!
    expect(heading.id).toBe('自己的标题')
    expect(firstP.id).toMatch(/^dc-/)
    expect(firstP.hasAttribute(commentTargetAttribute)).toBe(true)
    // 图片也按地址拿到稳定 id
    expect(scope.querySelector('img')!.id).toMatch(/^dc-/)
  })

  it('同页内容相同的两个元素按出现次序加后缀；走查重跑不产生新变更', () => {
    const scope = document.createElement('div')
    scope.innerHTML = '<p>一模一样的话</p><p>一模一样的话</p>'
    annotateCommentTargets(scope)
    const [a, b] = scope.querySelectorAll('p')
    expect(a.id).toMatch(/^dc-/)
    expect(b.id).toBe(`${a.id}-2`)
    const before = a.id
    annotateCommentTargets(scope)
    expect(a.id).toBe(before)
  })

  it('点正文拾取离点击处最近的候选元素', () => {
    const scope = sampleScope()
    annotateCommentTargets(scope)
    const em = scope.querySelector('em')!
    expect(commentTargetNear(em.firstChild!, scope)).toBe(scope.querySelectorAll('p')[0])
    // 布局容器不是候选：从容器本身点不中任何候选（这里容器是 scope 自己，返回 null）
    expect(commentTargetNear(scope, scope)).toBeNull()
  })

  it('元素写给人看的类别标签', () => {
    const scope = sampleScope()
    annotateCommentTargets(scope)
    expect(commentTargetLabelOf(scope.querySelector('img')!)).toBe('图片')
    expect(commentTargetLabelOf(scope.querySelector('h2')!)).toBe('「标题文字」')
  })
})

describe('落点推算（targetOfThread）', () => {
  it('元素锚点按 id 找，id 不在了算 element-id-gone', () => {
    const scope = sampleScope()
    annotateCommentTargets(scope)
    const pageText = pageTextOf(scope)
    const mapper = createRangeMapper()
    expect(targetOfThread(scope, pageText, { kind: 'element', id: '自己的标题' }, mapper).kind).toBe('element')
    expect(targetOfThread(scope, pageText, { kind: 'element', id: '不存在' }, mapper)).toEqual({ kind: 'missing', reason: 'element-id-gone' })
  })

  it('划字锚点：快照一样直接定位；正文改了按差异推算；整段删了算 text-unmapped', () => {
    const scope = sampleScope()
    const pageText = pageTextOf(scope)
    const mapper = createRangeMapper()
    // 选中第二段整段（含句号）
    const quote = '第二段话。'
    const anchor = { kind: 'text' as const, quote, start: pageText.text.indexOf(quote), end: pageText.text.indexOf(quote) + quote.length, snapshot: pageText.text }
    const placed = targetOfThread(scope, pageText, anchor, mapper)
    expect(placed.kind).toBe('text')
    if (placed.kind === 'text') {
      expect(placed.range.toString()).toBe(quote)
      expect(placed.changed).toBe(false)
    }

    // 换一版正文：前面加字，被批的字还在
    const scopeV2 = sampleScope()
    scopeV2.insertAdjacentHTML('afterbegin', '<p>开头新插的一段</p>')
    const pageTextV2 = pageTextOf(scopeV2)
    const moved = targetOfThread(scopeV2, pageTextV2, anchor, mapper)
    expect(moved.kind).toBe('text')
    if (moved.kind === 'text') expect(moved.range.toString()).toBe(quote)

    // 被批的字整段没了
    const scopeV3 = sampleScope()
    scopeV3.querySelectorAll('p')[1]!.textContent = '换成了别的话'
    expect(targetOfThread(scopeV3, pageTextOf(scopeV3), anchor, mapper)).toEqual({ kind: 'missing', reason: 'text-unmapped' })
  })

  it('认不出的 anchor 数据按 broken 处理', () => {
    const scope = sampleScope()
    expect(targetOfThread(scope, pageTextOf(scope), { kind: 'broken', raw: '{bad' }, createRangeMapper())).toEqual({ kind: 'missing', reason: 'broken-anchor' })
  })
})
