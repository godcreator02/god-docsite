/**
 * 外壳三：选情况。一排胶囊按钮选一种情况，画面下面是说明。
 * 给了 value 就是受控：选中哪个由外部管，点按钮只调用 onChange。
 * 给了 renderNone 就允许一个都不选：value / initial 可以是 null，这时画 renderNone、不显示说明；
 * 再点一次已按下的按钮会取消选中。
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
  /** 不受控时一开始选中哪个，默认第一个；给了 renderNone 时可以是 null（一个都不选） */
  initial?: string | null;
  /** 受控时当前选中哪个；给了 renderNone 时可以是 null */
  value?: string | null;
  /** 选中或取消选中（取消时是 null，只在给了 renderNone 时出现） */
  onChange?: (id: string | null) => void;
  /** 画面：给这种情况画什么 */
  children: (item: C) => ReactNode;
  /** 一个都不选时的画面；不给就不允许一个都不选 */
  renderNone?: () => ReactNode;
  /** 给读屏的名字 */
  label?: string;
}

export function CasePicker<C extends CaseItem>({ cases, initial, value, onChange, children, renderNone, label }: CasePickerProps<C>): JSX.Element {
  if (cases.length === 0) throw new Error("CasePicker 的 cases 不能是空数组");
  const [ownSelection, setOwnSelection] = useState<string | null>(initial === undefined ? cases[0]!.id : initial);
  const selectedId = value === undefined ? ownSelection : value;
  if (selectedId === null && renderNone === undefined) throw new Error("CasePicker 的 value / initial 是 null 时要给 renderNone，画一个都不选时的画面");
  const selectedIndex = selectedId === null ? -1 : cases.findIndex((item) => item.id === selectedId);
  if (selectedId !== null && selectedIndex === -1) throw new Error(`CasePicker 里没有 id 为「${selectedId}」的情况`);
  const selected = selectedIndex === -1 ? null : cases[selectedIndex]!;

  const pick = (id: string | null): void => {
    if (value === undefined) setOwnSelection(id);
    onChange?.(id);
  };
  const press = (id: string): void => pick(renderNone !== undefined && id === selectedId ? null : id);
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
          <button key={item.id} type="button" className="dx-case" aria-pressed={item.id === selected?.id} onClick={() => press(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="dx-stage">{selected === null ? renderNone!() : children(selected)}</div>
      {selected === null ? null : <Caption title={selected.label} text={selected.text} />}
    </div>
  );
}
