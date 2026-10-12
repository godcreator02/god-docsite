/**
 * 三种外壳共用的控制条按钮、说明行与键盘处理。
 * 分步与动画的控制条是同一行、同样的位置：[播放] [上一步] [中间：步号或横条] [下一步] [计数]。
 */
import type { JSX, KeyboardEvent } from "react";

function PlayIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
    </svg>
  );
}

function PauseIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="4" width="5" height="16" rx="1" />
      <rect x="14" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}

export function PlayButton({ playing, onToggle }: { playing: boolean; onToggle: () => void }): JSX.Element {
  return (
    <button type="button" className="dx-btn dx-btn-play" aria-label={playing ? "暂停" : "播放"} aria-pressed={playing} onClick={onToggle}>
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

export function PrevButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="dx-btn dx-btn-prev" aria-label="上一步" disabled={disabled} onClick={onClick}>
      <span aria-hidden="true">‹</span>
      <span className="dx-btn-text">上一步</span>
    </button>
  );
}

export function NextButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="dx-btn dx-btn-next" aria-label="下一步" disabled={disabled} onClick={onClick}>
      <span className="dx-btn-text">下一步</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

export function Counter({ current, total }: { current: number; total: number }): JSX.Element {
  return (
    <span className="dx-count" aria-hidden="true">
      {current} / {total}
    </span>
  );
}

/** 画面下方的说明：标题加粗，后面接说明文字。换步时读屏会念出新内容 */
export function Caption({ title, text }: { title: string; text: string }): JSX.Element {
  return (
    <p className="dx-caption" aria-live="polite">
      <b className="dx-caption-title">{title}</b>
      <span className="dx-caption-text">{text}</span>
    </p>
  );
}

export interface NavKeys {
  prev: () => void;
  next: () => void;
  /** 没有播放的外壳（选情况）不给，空格就留给浏览器 */
  toggle?: () => void;
}

/**
 * 外壳根元素的键盘处理：左右方向键上一步 / 下一步，空格播放 / 暂停。
 * 焦点在按钮上时空格留给按钮自己（按下它）；焦点在横条上时方向键留给横条（拖动时间）。
 * 带 Alt / Ctrl / Meta 的组合键是浏览器的（Alt+← 是后退），一律不接。
 */
export function navKeyHandler(keys: NavKeys): (event: KeyboardEvent<HTMLElement>) => void {
  return (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    const focusOnRoot = target === event.currentTarget;
    const focusOnSlider = target instanceof HTMLInputElement && target.type === "range";
    if (event.key === " ") {
      if (keys.toggle !== undefined && (focusOnRoot || focusOnSlider)) {
        event.preventDefault();
        keys.toggle();
      }
      return;
    }
    if (focusOnSlider) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      keys.prev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      keys.next();
    }
  };
}
