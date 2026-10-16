'use client';
/**
 * AnchorKinds：同一个 anchor 字段按字面认成四种结果。
 * 左卡摆串头里 anchor 那一行（CodeLines）；右卡是仿正文的小页面（标题、两段文字、一张图的占位），
 * 按选中的情况标出批中的地方：整页给整块描边、元素在标题旁画竖黄条、划字高亮那五个字、认不出的在页面角上挂 warn 胶囊。
 * 数据都在 anchor-kinds.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill } from '@godcreator/explainer/site';
import { cases } from './anchor-kinds.data.mjs';
import './anchor-kinds.css';

function PageView({ mark }: { mark: 'page' | 'element' | 'text' | 'broken' }): JSX.Element {
  return (
    <div className="ak-page" data-mark={mark === 'page' ? '' : undefined}>
      <div className="ak-heading" data-mark={mark === 'element' ? '' : undefined}>
        标题文字
      </div>
      <p className="ak-para">第一段话，着重的部分。</p>
      <p className="ak-para">
        <span data-hl={mark === 'text' ? '' : undefined}>第二段话。</span>
      </p>
      <p className="ak-para">
        <span className="ak-img" role="img" aria-label="图片" />
        后面还有字
      </p>
      {mark === 'broken' ? (
        <div className="ak-broken">
          <Pill tone="warn" dot>
            锚点数据认不出
          </Pill>
        </div>
      ) : null}
    </div>
  );
}

export function AnchorKinds(): JSX.Element {
  return (
    <CasePicker cases={cases} label="同一个 anchor 字段，按字面认成四种结果">
      {(item) => (
        <div key={item.id} className="ak-case">
          <Pane title="串头 index.mdx 的 anchor 行" icon="file" role="slate">
            <CodeLines lines={item.anchorLines} start={6} highlight={[6, 6]} tone="info" />
          </Pane>
          <Pane title="页面上批中的地方" role="blue">
            <PageView mark={item.mark} />
          </Pane>
        </div>
      )}
    </CasePicker>
  );
}
