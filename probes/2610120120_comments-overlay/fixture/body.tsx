import { useEffect, type ReactNode } from 'react'

/** 窗口滚动场景的正文：固定文字、重复文本、多行长段、代码块、图片、details 折叠、aria 折叠组件 */
export function WindowScrollBody(props: { bodyRef: (element: HTMLElement | null) => void; extraSentences: number; imageSource: string; detailsOpen: boolean; onDetailsOpenChange: (open: boolean) => void; widgetOpen: boolean; onWidgetOpenChange: (open: boolean) => void }) {
  return (
    <article className="doc-body" ref={props.bodyRef} data-body="window-scroll">
      <h2>窗口滚动的正文</h2>
      <p>
        这一段里有一处被批的固定文字：<em>覆盖层只测量不修改正文</em>。它前后还有普通文字，点被高亮的文字会打开评论，点正文里的
        <a href="#bottom-note" id="body-link">正文链接</a>不抢。
      </p>
      <p id="repeat-paragraph">
        这句话重复出现。中间夹了一句别的话。这句话重复出现。再夹一句。这句话重复出现。被批的是第二次出现的那一处——宿主的定位函数按出现次数找到正确的那个 Range，覆盖层不自己猜。
        {Array.from({ length: props.extraSentences }, (_, index) => (
          <span key={index}>追加的第 {index + 1} 句话，加了以后正文重排，各条评论要跟着重新定位。</span>
        ))}
      </p>
      <p className="long-paragraph">
        下面这条评论批的是一大段跨多行的文字：从这一行开始，一直到这里为止都属于被批的范围。改变窗口宽度、按工具条上的字号按钮，这段文字会换行重排，评论徽章应该贴住最后一行的右端，高亮跟随内容而不是留在原地。缩放浏览器（Ctrl+加号/减号）也一样。
      </p>
      <pre id="code-block">
        <code>{`// 代码块是被批的元素目标：覆盖层给它画框，徽章骑在框的右上角
function measureAll() {
  return markers.map((marker) => measure(marker))
}`}</code>
      </pre>
      <figure id="sample-figure">
        <img id="sample-image" src={props.imageSource} alt="示例图片" />
        <figcaption>图片目标：两条评论批同一个 figure，共用一个徽章；换图后重新定位</figcaption>
      </figure>
      <details id="fold-details" open={props.detailsOpen} onToggle={(event) => props.onDetailsOpenChange((event.target as HTMLDetailsElement).open)}>
        <summary>收起的细节（details）</summary>
        <p>折叠内容里被批的固定文字在收起时看不见：覆盖层报「看不见」，不乱飘；展开后（宿主或读者点开都行）它恢复定位。</p>
      </details>
      <Collapsible open={props.widgetOpen} onOpenChange={props.onWidgetOpenChange}>
        <p>自定义折叠组件里被批的文字：收起时同样报「看不见」，由宿主决定要不要替读者展开。</p>
      </Collapsible>
      <p>最后一段没有评论。</p>
    </article>
  )
}

/** aria-expanded 折叠样本：折叠行为是宿主组件自己的，覆盖层不碰它 */
function Collapsible(props: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <div className="collapsible">
      <button type="button" className="collapsible-toggle" aria-expanded={props.open} aria-controls="collapsible-panel" onClick={() => props.onOpenChange(!props.open)}>
        折叠面板（aria-expanded）{props.open ? ' ▲' : ' ▼'}
      </button>
      <div id="collapsible-panel" className="collapsible-panel" hidden={!props.open}>
        {props.children}
      </div>
    </div>
  )
}

/** 内部滚动容器场景的正文：目标分布在容器不同深度，滚动容器时徽章与高亮跟着内容走 */
export function ScrollContainerBody(props: { bodyRef: (element: HTMLElement | null) => void }) {
  return (
    <article className="doc-body" ref={props.bodyRef} data-body="scroll-container">
      <h2>滚动容器里的正文</h2>
      <p>滚动容器顶部目标：滚到容器里看它。下面还有很长的填充文字，把目标撑到不同的滚动深度。</p>
      <p className="filler">填充段落一。这一段没有任何评论，只是把正文撑长，让下面的目标落在滚动容器看不见的深处：改变滚动位置不影响徽章的位置，因为坐标在内容坐标系里。</p>
      <p>滚动容器中部目标：先把容器往下滚一点才能看到它。</p>
      <p className="filler">
        填充段落二。缩放字号时这一段变高变矮，上下两条评论跟着挪。窗口滚动与容器滚动叠加时也以内容坐标为准。
      </p>
      <p>滚动容器底部目标：在容器的最深处。</p>
      <p className="filler">填充段落三。</p>
    </article>
  )
}

/** 字号变化要作用到整页：挂在 <html> 上，正文用 rem 排版才会重排 */
export function useRootFontSize(scale: number) {
  useEffect(() => {
    document.documentElement.style.fontSize = `${scale}rem`
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [scale])
}
