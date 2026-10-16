'use client';
/**
 * PageText：划字的位置按「页面文字」数，不按 DOM 存。
 * 左卡「正文的 DOM」摆一小段 HTML 源码：标题里那段只给读屏软件看的字划掉（不算），图片是一个整体元素；
 * 右卡「页面文字」把整页文字逐字排成小方格，每格下面标序号（字从 0 数），图片那格标「图片」，
 * 「第二段话。」五个格（15 到 19）高亮，第 15 格标 start、第 20 格标 end（锚点按「不含 end」写成 15、20）。
 * 数据都在 page-text.data.mjs（共用例子在 example.data.mjs）。
 */
import type { JSX } from 'react';
import { Pane } from '@godcreator/explainer/site';
import { cells, dom, pageNote } from './page-text.data.mjs';
import { quoteSpan } from './example.data.mjs';
import './page-text.css';

function DomView(): JSX.Element {
  return (
    <pre className="pt-dom">
      <span className="pt-dom-line">{dom.headingOpen}</span>
      <span className="pt-dom-line">
        {dom.srOnlyOpen}
        <s className="pt-sr-only">{dom.srOnlyText}</s>
        {dom.srOnlyClose}
      </span>
      <span className="pt-dom-line">{dom.headingClose}</span>
      <span className="pt-dom-line">{dom.paraStrong}</span>
      <span className="pt-dom-line">{dom.paraQuoted}</span>
      <span className="pt-dom-line">{dom.paraImage}</span>
    </pre>
  );
}

/** 字格：每格下面标序号（字从 0 数），划字高亮的格子下面另标 start / end，整个算一个字的格子标「图片」 */
function TextCells(): JSX.Element {
  return (
    <div className="pt-cells" role="img" aria-label={`页面文字，共 ${cells.length} 个字，字从 0 数，第 15 到 19 个字高亮`}>
      {cells.map((item, index) => (
        <span key={index} className="pt-cell-unit">
          <span className="pt-cell" data-hl={index >= quoteSpan[0] && index < quoteSpan[1] ? '' : undefined}>
            {item.char}
            {item.atomic ? <i className="pt-cell-tag">图片</i> : null}
          </span>
          <i className="pt-cell-no">{index}</i>
          {index === quoteSpan[0] ? <i className="pt-cell-mark">start</i> : null}
          {index === quoteSpan[1] ? <i className="pt-cell-mark">end</i> : null}
        </span>
      ))}
    </div>
  );
}

export function PageText(): JSX.Element {
  return (
    <div className="dx pt-pair not-prose">
      <Pane title="正文的 DOM" icon="file" role="slate">
        <DomView />
      </Pane>
      <Pane title="页面文字（数位置的这份）" role="blue">
        <TextCells />
        <p className="pt-note">{pageNote}</p>
      </Pane>
    </div>
  );
}
