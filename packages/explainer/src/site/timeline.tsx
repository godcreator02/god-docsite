/**
 * 外壳二：动画。控制条与分步同一行、同样位置，只是中间换成横条：[播放] [上一步] [横条] [下一步] [当前章/总章]。
 * 时间是连续的秒数：播放按 requestAnimationFrame 推进，到末尾停；拖横条停在任意一刻（拖动时暂停）；
 * 上一步 / 下一步跳到章节开头。画面是 time → 画面 的纯函数，所以往回拖也画得出来。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import { Caption, Counter, NextButton, PlayButton, PrevButton, navKeyHandler } from "./controls.tsx";

export interface Chapter {
  title: string;
  text: string;
  /** 这一段的长度，秒 */
  duration: number;
}

/** 说明要放公式等排版时用它：text 是 ReactNode，这样的数据不能交给 chaptersText 转机读文字 */
export interface RichChapter extends Omit<Chapter, "text"> {
  text: ReactNode;
}

export interface TimelineFrame<C extends RichChapter> {
  /** 从开头算起的秒数 */
  time: number;
  chapter: C;
  index: number;
  /** 本章内的进度，0–1 */
  progress: number;
}

export interface TimelineProps<C extends RichChapter> {
  chapters: readonly C[];
  /** 画面：给这一刻画什么 */
  children: (frame: TimelineFrame<C>) => ReactNode;
  /** 给读屏的名字 */
  label?: string;
}

/** 离本章开头超过这么多秒时，「上一步」先回到本章开头，而不是跳到上一章 */
const BACK_TO_CHAPTER_START_AFTER = 0.6;

/** 每一章开头的时刻（秒），第一章是 0 */
function chapterStarts(chapters: readonly RichChapter[]): number[] {
  const starts: number[] = [];
  let sum = 0;
  for (const chapter of chapters) {
    starts.push(sum);
    sum += chapter.duration;
  }
  return starts;
}

/** time 落在哪一章：末尾那一刻算最后一章 */
function chapterIndexAt(starts: readonly number[], time: number): number {
  let index = 0;
  while (index + 1 < starts.length && starts[index + 1]! <= time) index++;
  return index;
}

function assertChaptersPlayable(chapters: readonly RichChapter[]): void {
  if (chapters.length === 0) throw new Error("Timeline 的 chapters 不能是空数组");
  for (const chapter of chapters) {
    if (!(chapter.duration > 0)) throw new Error(`Timeline 的章节「${chapter.title}」duration 得是正数秒，现在是 ${chapter.duration}`);
  }
}

export function Timeline<C extends RichChapter>({ chapters, children, label }: TimelineProps<C>): JSX.Element {
  assertChaptersPlayable(chapters);
  const starts = useMemo(() => chapterStarts(chapters), [chapters]);
  const total = starts[starts.length - 1]! + chapters[chapters.length - 1]!.duration;

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 播放循环读的是这份：播放途中按上一步 / 下一步改了时间，下一帧从新时间接着走
  const timeRef = useRef(0);

  const seek = (to: number): void => {
    const clamped = Math.min(Math.max(to, 0), total);
    timeRef.current = clamped;
    setTime(clamped);
  };

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previousNow: number | null = null;
    const tick = (now: number): void => {
      const elapsed = previousNow === null ? 0 : (now - previousNow) / 1000;
      previousNow = now;
      const nextTime = Math.min(timeRef.current + elapsed, total);
      timeRef.current = nextTime;
      setTime(nextTime);
      if (nextTime >= total) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);

  const index = chapterIndexAt(starts, time);
  const chapter = chapters[index]!;
  const chapterStart = starts[index]!;
  const progress = Math.min((time - chapterStart) / chapter.duration, 1);

  const toggle = (): void => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (time >= total) seek(0);
    setPlaying(true);
  };
  const prev = (): void => {
    if (time - chapterStart > BACK_TO_CHAPTER_START_AFTER || index === 0) seek(chapterStart);
    else seek(starts[index - 1]!);
  };
  const next = (): void => {
    seek(index < chapters.length - 1 ? starts[index + 1]! : total);
  };
  const percent = (seconds: number): string => `${(seconds / total) * 100}%`;

  return (
    <div
      className="dx dx-timeline not-prose"
      role="group"
      aria-label={label}
      aria-keyshortcuts="ArrowLeft ArrowRight Space"
      tabIndex={0}
      onKeyDown={navKeyHandler({ prev, next, toggle })}
    >
      <div className="dx-bar">
        <PlayButton playing={playing} onToggle={toggle} />
        <PrevButton disabled={time <= 0} onClick={prev} />
        <div className="dx-scrub">
          <div className="dx-scrub-rail" aria-hidden="true">
            <div className="dx-scrub-track">
              <div className="dx-scrub-fill" style={{ width: percent(time) }} />
            </div>
            {starts.slice(1).map((start) => (
              <span key={start} className="dx-scrub-tick" style={{ left: percent(start) }} />
            ))}
            <span className="dx-scrub-thumb" style={{ left: percent(time) }} />
          </div>
          <input
            type="range"
            min={0}
            max={total}
            step="any"
            value={time}
            aria-label="时间"
            aria-valuetext={`第 ${index + 1} 段 · ${chapter.title}`}
            onPointerDown={() => setPlaying(false)}
            onChange={(event) => {
              setPlaying(false);
              seek(Number(event.currentTarget.value));
            }}
          />
        </div>
        <NextButton disabled={time >= total} onClick={next} />
        <Counter current={index + 1} total={chapters.length} />
      </div>
      <div className="dx-stage">{children({ time, chapter, index, progress })}</div>
      <Caption title={chapter.title} text={chapter.text} />
    </div>
  );
}
