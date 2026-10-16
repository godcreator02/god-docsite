'use client';
/**
 * LayoutColumns：容器上的宽度变量默认都是 0，哪个部件渲染了，就借 :has() 把自己那一列的宽度写回容器；
 * 部件不渲染，那一列就消失。一块缩小的页面框按 grid 模板画几个区，框上一行是此刻的变量值，
 * 框下一行是这一刻哪个部件带的哪个 layout:[…] 类。数据都在 layout-columns.data.mjs。
 */
import type { CSSProperties, JSX } from 'react';
import { CasePicker } from '@godcreator/explainer/site';
import { areaRoles, cases } from './layout-columns.data.mjs';
import type { FrameCell, WhoLine } from './layout-columns.data.mjs';
import './layout-columns.css';

function Cell({ cell }: { cell: FrameCell }): JSX.Element {
  const roleKey = cell.area === 'side' ? 'sidebar' : cell.area === 'pop' ? 'tocPopover' : cell.area;
  return (
    <div className="lc-cell" data-role={areaRoles[roleKey]} style={{ gridArea: cell.area }}>
      <span className="lc-cell-name">{cell.label}</span>
      {cell.sub === undefined ? null : <span className="lc-cell-sub">{cell.sub}</span>}
    </div>
  );
}

function Who({ line }: { line: WhoLine }): JSX.Element {
  return (
    <span className="lc-who">
      <i
        className="lc-who-dot"
        data-role={line.role === undefined ? undefined : areaRoles[line.role]}
        data-hollow={line.role === undefined ? true : undefined}
        aria-hidden="true"
      />
      <code>{line.text}</code>
    </span>
  );
}

export function LayoutColumns(): JSX.Element {
  return (
    <CasePicker cases={cases} label="四种宽度与页面情况下，各是谁在写布局变量">
      {(item) => (
        <div key={item.id} className="lc-case">
          <p className="lc-vars">
            <span>此刻容器上的两个变量：</span>
            <code>{item.vars.sidebar}</code>
            <code>{item.vars.toc}</code>
          </p>
          <div
            className="lc-frame"
            style={{
              gridTemplateColumns: item.columns,
              gridTemplateRows: item.rows,
              gridTemplateAreas: item.areas.map((row) => `"${row}"`).join(' '),
            } as CSSProperties}
          >
            {item.cells.map((cell) => (
              <Cell key={cell.area} cell={cell} />
            ))}
          </div>
          <div className="lc-who-row">
            {item.who.map((line) => (
              <Who key={line.text} line={line} />
            ))}
          </div>
        </div>
      )}
    </CasePicker>
  );
}
