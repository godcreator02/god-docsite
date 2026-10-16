'use client';
/**
 * MetaPages：同一个文件夹，meta.json 的 pages 写法不同，侧栏里排出来的样子不同。
 * 左边一张卡片摆 meta.json，右边一块仿侧栏的竖列——页面项、文件夹项（展开子项）、分隔线、链接项各一种样式；
 * 有 root.fallback 子树的写法在侧栏下面另起一小块。数据都在 meta-pages.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane } from '@godcreator/explainer/site';
import { cases, folderNote } from './meta-pages.data.mjs';
import type { SideItem } from './meta-pages.data.mjs';
import './meta-pages.css';

function Item({ item }: { item: SideItem }): JSX.Element {
  if (item.kind === 'separator') {
    return <div className="mp-sep">{item.name}</div>;
  }
  if (item.kind === 'link') {
    return (
      <div className="mp-item mp-link">
        {item.name}
        <span className="mp-ext" aria-hidden="true">↗</span>
      </div>
    );
  }
  if (item.kind === 'folder') {
    return (
      <div className="mp-folder">
        <div className="mp-item">
          <span className="mp-chev" aria-hidden="true">▾</span>
          {item.name}
        </div>
        {(item.children ?? []).map((child) => (
          <div key={child} className="mp-item mp-child">{child}</div>
        ))}
      </div>
    );
  }
  return <div className="mp-item">{item.name}</div>;
}

export function MetaPages(): JSX.Element {
  return (
    <CasePicker cases={cases} label="meta.json 的 pages 六种写法，侧栏各排成什么样">
      {(item) => (
        <div key={item.id} className="mp-case">
          <Pane title="meta.json" icon="file" role="blue" extra={<span className="mp-note">{folderNote}</span>}>
            <CodeLines lines={item.metaLines} />
          </Pane>
          <div className="mp-right">
            <Pane title="侧栏（这个文件夹）" icon="folder" role="emerald">
              <div className="mp-side">
                {item.sidebar.map((side) => (
                  <Item key={side.name} item={side} />
                ))}
              </div>
            </Pane>
            {item.fallback === null ? null : (
              <div className="mp-fallback">
                <span className="mp-fallback-label">root.fallback</span>
                <div className="mp-side">
                  {item.fallback.map((side) => (
                    <Item key={side.name} item={side} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </CasePicker>
  );
}
