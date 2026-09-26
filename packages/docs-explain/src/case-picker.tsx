/**
 * 外壳三：选情况。一排胶囊按钮选一种情况，画面下面是说明。
 * 给了 value 就是受控：选中哪个由外部管，点按钮只调用 onChange。
 */
import { useState } from "react";
import type { JSX, ReactNode } from "react";
import { Caption, navKeyHandler } from "./controls.tsx";

export interface CaseItem {
  id: string;
  label: string;
  text: string;
}

export interface CasePickerProps<C extends CaseItem> {
  cases: readonly C[];
  /** 不受控时一开始选中哪个，默认第一个 */
  initial?: string;
  /** 受控时当前选中哪个 */
  value?: string;
  onChange?: (id: string) => void;
  /** 画面：给这种情况画什么 */
  children: (item: C) => ReactNode;
  /** 给读屏的名字 */
  label?: string;
}

export function CasePicker<C extends CaseItem>({ cases, initial, value, onChange, children, label }: CasePickerProps<C>): JSX.Element {
  if (cases.length === 0) throw new Error("CasePicker 的 cases 不能是空数组");
  const [ownSelection, setOwnSelection] = useState(initial ?? cases[0]!.id);
  const selectedId = value ?? ownSelection;
  const selectedIndex = cases.findIndex((item) => item.id === selectedId);
  if (selectedIndex === -1) throw new Error(`CasePicker 里没有 id 为「${selectedId}」的情况`);
  const selected = cases[selectedIndex]!;

  const pick = (id: string): void => {
    if (value === undefined) setOwnSelection(id);
    onChange?.(id);
  };
  const prev = (): void => {
    if (selectedIndex > 0) pick(cases[selectedIndex - 1]!.id);
  };
  const next = (): void => {
    if (selectedIndex < cases.length - 1) pick(cases[selectedIndex + 1]!.id);
  };

  return (
    <div
      className="dx dx-cases not-prose"
      role="group"
      aria-label={label}
      aria-keyshortcuts="ArrowLeft ArrowRight"
      tabIndex={0}
      onKeyDown={navKeyHandler({ prev, next })}
    >
      <div className="dx-case-row" role="group" aria-label="选一种情况">
        {cases.map((item) => (
          <button key={item.id} type="button" className="dx-case" aria-pressed={item.id === selected.id} onClick={() => pick(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="dx-stage">{children(selected)}</div>
      <Caption title={selected.label} text={selected.text} />
    </div>
  );
}
