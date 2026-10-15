/**
 * 外壳一：分步。控制条在画面上方：[播放] [上一步] [1][2]…[n] [下一步] [当前/总数]，画面下面是说明。
 * 播放 = 每隔 interval 毫秒自动下一步，到最后一步停；在最后一步按播放从第 1 步重来。
 */
import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";
import { Caption, Counter, NextButton, PlayButton, PrevButton, navKeyHandler } from "./controls.tsx";

export interface StepItem {
  title: string;
  text: string;
}

export interface StepperProps<S extends StepItem> {
  steps: readonly S[];
  /** 画面：给当前这一步画什么 */
  children: (step: S, index: number) => ReactNode;
  /** 播放时每一步停留的毫秒数 */
  interval?: number;
  /** 给读屏的名字 */
  label?: string;
}

export function Stepper<S extends StepItem>({ steps, children, interval = 3500, label }: StepperProps<S>): JSX.Element {
  if (steps.length === 0) throw new Error("Stepper 的 steps 不能是空数组");
  const last = steps.length - 1;
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);

  // 到最后一步就停：手动跳到最后一步也算，免得播放键一直显示「暂停」却什么都不动
  const go = (index: number): void => {
    setAt(index);
    if (index === last) setPlaying(false);
  };

  useEffect(() => {
    if (!playing || at >= last) return;
    const timer = setTimeout(() => {
      setAt(at + 1);
      if (at + 1 === last) setPlaying(false);
    }, interval);
    return () => clearTimeout(timer);
  }, [playing, at, last, interval]);

  const toggle = (): void => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (at === last) setAt(0);
    setPlaying(last > 0);
  };
  const prev = (): void => {
    if (at > 0) go(at - 1);
  };
  const next = (): void => {
    if (at < last) go(at + 1);
  };
  const step = steps[at]!;

  return (
    <div
      className="dx dx-stepper not-prose"
      role="group"
      aria-label={label}
      aria-keyshortcuts="ArrowLeft ArrowRight Space"
      tabIndex={0}
      onKeyDown={navKeyHandler({ prev, next, toggle })}
    >
      <div className="dx-bar">
        <PlayButton playing={playing} onToggle={toggle} />
        <PrevButton disabled={at === 0} onClick={prev} />
        <div className="dx-steps" role="group" aria-label="步骤">
          {steps.map((item, index) => (
            <button
              key={index}
              type="button"
              className="dx-step"
              aria-current={index === at ? "step" : undefined}
              aria-label={`第 ${index + 1} 步：${item.title}`}
              title={item.title}
              onClick={() => go(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <NextButton disabled={at === last} onClick={next} />
        <Counter current={at + 1} total={steps.length} />
      </div>
      <div className="dx-stage">{children(step, at)}</div>
      <Caption title={step.title} text={step.text} />
    </div>
  );
}
