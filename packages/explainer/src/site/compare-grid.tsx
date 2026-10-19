/**
 * 零件：对比表。几种做法并排成栏，一行讲一个方面；放进动画或分步的画面里，按章号决定每格亮不亮。
 * 每格的状态由调用方给：hidden 还没讲到（留着位置不显示）、off 淡、on 讲过、active 正在讲（描边）。
 */
import { Fragment } from "react";
import type { JSX, ReactNode } from "react";
import type { Role } from "../core/colors.ts";

export type CellState = "hidden" | "off" | "on" | "active";

export interface CompareColumn {
  title: ReactNode;
  /** 标题下面一行小字 */
  note?: ReactNode;
  /** 这一栏的颜色：栏头和这一栏的格子都用它 */
  role: Role;
}

/** 一格：直接给内容就用这一栏的颜色；要换颜色写成 `{ content, role }` */
export type CompareCell = ReactNode | { content: ReactNode; role: Role };

export interface CompareRow {
  label: ReactNode;
  cells: CompareCell[];
}

export interface CompareGridProps {
  columns: CompareColumn[];
  rows: CompareRow[];
  cellState: (row: number, column: number) => CellState;
  /** 最左边一列（每行的方面名）的宽度，CSS 长度 */
  labelWidth?: string;
  /** 表格的最小宽度（像素）；容器更窄时在自己的框里横向滚动 */
  minWidth: number;
}

function isRoleCell(cell: CompareCell): cell is { content: ReactNode; role: Role } {
  return typeof cell === "object" && cell !== null && "content" in cell && "role" in cell;
}

export function CompareGrid({ columns, rows, cellState, labelWidth = "6.5em", minWidth }: CompareGridProps): JSX.Element {
  rows.forEach((row, index) => {
    if (row.cells.length !== columns.length) throw new Error(`对比表第 ${index + 1} 行有 ${row.cells.length} 格，应为 ${columns.length} 格`);
  });
  return (
    <div className="dx-compare-scroll">
      <div className="dx-compare" style={{ gridTemplateColumns: `${labelWidth} repeat(${columns.length}, minmax(0, 1fr))`, minWidth }}>
        <span />
        {columns.map((column, index) => (
          <div key={index} className="dx-compare-head" data-role={column.role}>
            <span>{column.title}</span>
            {column.note !== undefined ? <span className="dx-compare-note">{column.note}</span> : null}
          </div>
        ))}
        {rows.map((row, rowIndex) => {
          const states = row.cells.map((_, columnIndex) => cellState(rowIndex, columnIndex));
          const labelOn = states.some((state) => state === "on" || state === "active");
          return (
            <Fragment key={rowIndex}>
              <span className="dx-compare-label" data-on={labelOn ? true : undefined}>
                {row.label}
              </span>
              {row.cells.map((cell, columnIndex) => (
                // 从 hidden 变出来时换 key 重新挂载，格子里的胶囊才会弹出一次
                <div
                  key={`${columnIndex}-${states[columnIndex] === "hidden"}`}
                  className="dx-compare-cell"
                  data-role={isRoleCell(cell) ? cell.role : columns[columnIndex]!.role}
                  data-state={states[columnIndex]}
                >
                  {isRoleCell(cell) ? cell.content : cell}
                </div>
              ))}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** 最常见的状态规则：每行从第几章开始讲；没到 hidden，正在讲的章 active，之后 on */
export function revealByRow(rowStarts: readonly number[], current: number, activeRows: readonly number[] = []): (row: number) => CellState {
  return (row) => {
    const start = rowStarts[row];
    if (start === undefined) throw new Error(`revealByRow 没有第 ${row + 1} 行的开始章号`);
    if (current < start) return "hidden";
    if (current === start || activeRows.includes(row)) return "active";
    return "on";
  };
}
