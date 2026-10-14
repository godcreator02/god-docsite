"use client";

/**
 * 客户端组件 StarDisk——星轨盘的 React 壳，只当编排者。
 *
 * 壳管状态与 HUD：容器、工具条、图例、设置 / 帮助 / 搜索浮层、主题监听、悬停小气泡。
 * 画布是一个空 div，交给整搬的画布层（canvas/stage.ts 照 Obsidian 版 star-view 的编排：
 * buildCtx → 六层 build，每帧 place，筛选 / 主题变化 recolor，帧循环 tick）——React 不画任何 SVG，
 * `renderToStaticMarkup` 那一趟画布区就是空的。日期竖轨由 DateRail 在壳渲的 `.star-rail` 容器里自建 DOM，跟工具条排在右侧同一列。
 *
 * 交互范式：滚轮 = 空间缩放指哪缩哪 + 拖拽漫游；ctrl + 滚轮 = 时间平移；日期轨收窄窗即进透镜；
 * 回到原点两段式（相机动过先归相机、再按归窗；Esc 同链）；盘心单击开根卡、双击回全景；
 * 点节点在右侧栏看卡（正文由盘页在服务端渲染好传进来，不跳页），Ctrl/Cmd+点在新标签页开卡页。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { HELP_HTML, legendHtml } from "./canvas/hud.ts";
import type { FilterSel } from "./canvas/node-dom.ts";
import {
  DEFAULT_SETTINGS,
  SETTING_ITEMS,
  settingsOf,
  type TrajectorySettings,
} from "./canvas/settings.ts";
import { type HomeState, StarStage } from "./canvas/stage.ts";
import { buildThemes } from "./canvas/theme.ts";
import { buildModel } from "../../core/model/build.ts";
import type { Card, DiskInput } from "../../core/model/types.ts";

/** StarDisk 的 props：data 是下游送进来的一张盘（盘心加一组卡，组件自己建模），hrefBase 是卡页路由前缀
 * （卡页地址 = `${hrefBase}/${encodeURIComponent(id)}`），bodies 是每张卡（含根卡）渲染好的正文、
 * 键是卡身份——不收函数，服务端组件传不了函数给客户端组件。
 * 容器吃满父元素（高度由页面给），滚轮直接作用于盘。顶栏不归组件画。 */
export interface StarDiskProps {
  data: DiskInput;
  hrefBase: string;
  bodies: Record<string, ReactNode>;
}

/** localStorage 里手感参数的键。 */
const SETTINGS_KEY = "live-doc-trajectory.settings";
/** localStorage 里侧栏宽度的键。 */
const SIDE_WIDTH_KEY = "live-doc-trajectory.side-width";
/** 侧栏默认宽与可拖范围（px）；上限另受整盘宽度的七成约束。 */
const SIDE_WIDTH_DEFAULT = 460;
const SIDE_WIDTH_MIN = 320;
/** 地址栏里记当前打开的卡的查询参数名。 */
const CARD_PARAM = "card";

function loadSideWidth(): number {
  if (typeof window === "undefined") return SIDE_WIDTH_DEFAULT;
  try {
    const n = Number(window.localStorage.getItem(SIDE_WIDTH_KEY));
    return Number.isFinite(n) && n >= SIDE_WIDTH_MIN ? n : SIDE_WIDTH_DEFAULT;
  } catch {
    return SIDE_WIDTH_DEFAULT;
  }
}

/** 把当前打开的卡写进地址栏（null = 去掉参数）；只换地址不进历史，不触发路由。 */
function writeCardParam(id: string | null): void {
  const url = new URL(window.location.href);
  if (id === null) url.searchParams.delete(CARD_PARAM);
  else url.searchParams.set(CARD_PARAM, id);
  window.history.replaceState(window.history.state, "", url);
}

function loadSettings(): TrajectorySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? settingsOf(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: TrajectorySettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 存不了就算了：手感参数只是便利 */
  }
}

/* ---------- 工具条图标：内联 SVG，24 格 lucide 口径 ---------- */

const ICON_PATHS: Record<string, string> = {
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z M20 20l-3.5-3.5",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  eye: "M2 12s3.5-7 10-7s10 7 10 7s-3.5 7-10 7s-10-7-10-7z M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z",
  home: "M3 11l9-8l9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z",
  shrink: "M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7",
  history: "M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 7v5l3 3",
  settings: "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4",
  help: "M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7 M12 17h.01",
  close: "M6 6l12 12 M18 6L6 18",
};

function Icon({ name }: { name: string }): ReactNode {
  return (
    <svg
      className="star-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name] ?? ""} />
    </svg>
  );
}

/** 回到原点钮三态：图标与说明随「下一按干什么」换脸。 */
const HOME_FACE: Record<HomeState, { icon: string; title: string }> = {
  camera: { icon: "shrink", title: "回到大图（Esc 同效）" },
  window: { icon: "history", title: "窗回顶满（Esc 同效）" },
  idle: { icon: "home", title: "已在原点" },
};

type PopKey = "legend" | "search" | "settings" | "help";

/** 悬停小气泡的内容。 */
interface Tip {
  label: string;
  bornAt: string;
  meta: string;
}

export function StarDisk({ data, hrefBase, bodies }: StarDiskProps): ReactNode {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<StarStage | null>(null);
  /** 指针在容器里的最近位置：小气泡摆放用（悬停回调不带坐标） */
  const pointerRef = useRef({ x: 0, y: 0 });

  const [dark, setDark] = useState(false);
  const [formFilter, setFormFilter] = useState<ReadonlySet<string>>(new Set());
  const [domainFilter, setDomainFilter] = useState<ReadonlySet<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [popOpen, setPopOpen] = useState<PopKey | null>(null);
  const [homeState, setHomeState] = useState<HomeState>("idle");
  const [hits, setHits] = useState<{ hit: number; total: number }>({ hit: 0, total: 0 });
  const [tip, setTip] = useState<Tip | null>(null);
  const [settings, setSettings] = useState<TrajectorySettings>(loadSettings);
  /** 侧栏里正在看的卡；null = 侧栏关着 */
  const [openId, setOpenId] = useState<string | null>(null);
  const [sideWidth, setSideWidth] = useState(loadSideWidth);

  /* ---------- 建模：输入变了才重建 ---------- */
  const model = useMemo(() => buildModel(data), [data]);
  const themeName = dark ? "dark" : "light";
  const isEmpty = model.cards.length === 0;

  /* ---------- 侧栏看卡：打开 / 关闭同步盘上的选中标记与地址栏 ---------- */
  const openInSide = useCallback((id: string) => {
    setOpenId(id);
    stageRef.current?.setSelected(id);
    writeCardParam(id);
  }, []);
  const closeSide = useCallback(() => {
    setOpenId(null);
    stageRef.current?.setSelected(null);
    writeCardParam(null);
  }, []);

  /* ---------- 舞台：挂载建一次，随组件存活；数据 / 主题 / 筛选各自经 effect 灌 ---------- */
  const hrefOf = useCallback((id: string) => `${hrefBase}/${encodeURIComponent(id)}`, [hrefBase]);
  const hrefOfRef = useRef(hrefOf);
  hrefOfRef.current = hrefOf;
  const openInSideRef = useRef(openInSide);
  openInSideRef.current = openInSide;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const railEl = railRef.current;
    if (!canvasEl || !railEl) return;
    const stage = new StarStage(
      {
        canvasEl,
        railEl,
        /* 点节点 / 盘心：侧栏看卡；Ctrl/Cmd+点在新标签页开卡页 */
        openCard: (id, inNewTab) => {
          if (inNewTab) window.open(hrefOfRef.current(id), "_blank", "noopener");
          else openInSideRef.current(id);
        },
        onHover: (card: Card | null) => {
          if (card) {
            setTip({
              label: card.label,
              bornAt: card.bornAt.slice(0, 10),
              meta: `${card.domain} · ${modelRef.current.supersededIds.has(card.id) ? "被取代" : "在立"}`,
            });
          } else setTip(null);
        },
        onHomeState: setHomeState,
        onHits: (hit, total) => setHits({ hit, total }),
      },
      settingsRef.current,
    );
    stageRef.current = stage;
    return () => {
      stage.destroy();
      stageRef.current = null;
    };
  }, []);

  /* 首开与数据变了：模型灌进舞台，画布整棵重建 */
  useEffect(() => {
    stageRef.current?.setData(model);
    setTip(null);
  }, [model]);

  /* 首开：地址栏带着 ?card= 就直接在侧栏打开那张（链接发给别人、刷新都停在同一张卡） */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get(CARD_PARAM);
    if (id) openInSide(id);
  }, [openInSide]);

  /* ---------- 主题：挂载时读一次 html.dark，之后靠 MutationObserver 跟随 ---------- */
  useEffect(() => {
    const root = document.documentElement;
    setDark(root.classList.contains("dark"));
    const mo = new MutationObserver(() => setDark(root.classList.contains("dark")));
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  useEffect(() => {
    stageRef.current?.setTheme(themeName);
  }, [themeName]);

  /* ---------- 筛选：形态 + 领域取交集，搜索只匹配 label 与卡身份 ---------- */
  const searchLower = search.trim().toLowerCase();
  const filterSel = useMemo<FilterSel>(
    () => ({ form: new Set(formFilter), domain: new Set(domainFilter), search: searchLower }),
    [formFilter, domainFilter, searchLower],
  );
  useEffect(() => {
    stageRef.current?.setFilter(filterSel);
  }, [filterSel, model]);
  useEffect(() => {
    stageRef.current?.setShowAllLabels(showAllLabels);
  }, [showAllLabels]);

  /* ---------- Esc 分层：先收浮层，再关侧栏，最后走两段式回原点 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (popOpen) {
        setPopOpen(null);
        return;
      }
      if (openId !== null) {
        closeSide();
        return;
      }
      stageRef.current?.goHome();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popOpen, openId, closeSide]);

  /* ---------- 侧栏宽度：拖分割条改，松手记进 localStorage ---------- */
  const onSplitPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const root = rootRef.current;
    if (!root) return;
    e.preventDefault();
    const bar = e.currentTarget;
    bar.setPointerCapture(e.pointerId);
    const right = root.getBoundingClientRect().right;
    const max = root.getBoundingClientRect().width * 0.7;
    let width = sideWidth;
    const move = (ev: PointerEvent): void => {
      width = Math.round(Math.min(max, Math.max(SIDE_WIDTH_MIN, right - ev.clientX)));
      setSideWidth(width);
    };
    const up = (): void => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      try {
        window.localStorage.setItem(SIDE_WIDTH_KEY, String(width));
      } catch {
        /* 存不了就算了：宽度只是便利 */
      }
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
  };

  /* ---------- 侧栏正文里指向别的卡的链接：在侧栏里切换，不跳页（Ctrl/Cmd+点照常） ---------- */
  const onSideBodyClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if (e.ctrlKey || e.metaKey || e.button !== 0) return;
    const a = e.target instanceof Element ? e.target.closest("a") : null;
    if (!a) return;
    const url = new URL(a.href, window.location.href);
    const prefix = `${hrefBase}/`;
    if (url.origin !== window.location.origin || !url.pathname.startsWith(prefix)) return;
    e.preventDefault();
    openInSide(decodeURIComponent(url.pathname.slice(prefix.length)));
  };

  /* ---------- 设置滑杆：语义值进状态与 localStorage，舞台按项目表落到布局 ---------- */
  const applySetting = useCallback((key: keyof TrajectorySettings, value: number) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
    stageRef.current?.applySetting(key, value);
  }, []);

  /* ---------- 图例即筛选器：点形态 / 领域项进出选中集 ---------- */
  const toggleSet = (set: ReadonlySet<string>, v: string): Set<string> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };
  const onLegendClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target instanceof Element ? e.target.closest("[data-f]") : null;
    if (!t) return;
    const f = t.getAttribute("data-f");
    const v = t.getAttribute("data-v");
    if (!f || !v) return;
    if (f === "form") setFormFilter((prev) => toggleSet(prev, v));
    else setDomainFilter((prev) => toggleSet(prev, v));
  }, []);
  const legendMarkup = useMemo(
    () => legendHtml(buildThemes(model.domains)[themeName], model.domains, filterSel),
    [model.domains, themeName, filterSel],
  );

  const filterActive = formFilter.size > 0 || domainFilter.size > 0 || searchLower.length > 0;
  const togglePop = (k: PopKey): void => setPopOpen((v) => (v === k ? null : k));
  const clearFilters = (): void => {
    setFormFilter(new Set());
    setDomainFilter(new Set());
    setSearch("");
  };

  /* 悬停小气泡跟指针：位置直接写 DOM，不走状态 */
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const el = tooltipRef.current;
    if (el) {
      el.style.left = `${pointerRef.current.x + 12}px`;
      el.style.top = `${pointerRef.current.y + 12}px`;
    }
  };

  const home = HOME_FACE[homeState];
  const side = openId === null ? null : sideCardOf(openId);

  return (
    <div
      ref={rootRef}
      className="star-disk"
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", display: "flex" }}
    >
      <div ref={containerRef} className="star-main" onPointerMove={onPointerMove}>
      {/* 画布区：空 div 交给画布层，svg 由舞台建 */}
      <div ref={canvasRef} className="star-canvas" aria-label={model.center?.label ?? "星轨盘"} />

      {/* 悬停小气泡 */}
      {tip ? (
        <div
          ref={tooltipRef}
          className="star-tooltip"
          style={{ left: pointerRef.current.x + 12, top: pointerRef.current.y + 12 }}
        >
          <div className="star-tooltip-title">{tip.label}</div>
          <div className="star-tooltip-meta">
            {tip.bornAt} · {tip.meta}
          </div>
        </div>
      ) : null}

      {/* 右侧一列：上面竖排工具条，下面日期竖轨（DateRail 在 .star-rail 里自建 DOM）；侧栏打开时整列让到侧栏左边 */}
      <div className="star-dock" style={openId !== null ? { right: sideWidth + 10 } : undefined}>
      {/* 竖排工具条：上簇 搜索 / 图例 / 全部标签，下簇 回到原点 / 设置 / 帮助；浮层从它左侧弹出 */}
      <div className="star-hud-top">
        <button
          type="button"
          className={`star-mbtn${popOpen === "search" ? " star-open" : ""}${searchLower ? " star-active" : ""}`}
          title="搜索卡片（label 与卡身份）"
          onClick={() => togglePop("search")}
        >
          <Icon name="search" />
        </button>
        <button
          type="button"
          className={`star-mbtn star-legend-fab${popOpen === "legend" ? " star-open" : ""}${filterActive ? " star-has-filter" : ""}`}
          title="图例与筛选"
          onClick={() => togglePop("legend")}
        >
          <Icon name="filter" />
        </button>
        <button
          type="button"
          className={`star-mbtn${showAllLabels ? " star-active" : ""}`}
          title="全部标签：无视 LOD 全显（重叠也显）"
          onClick={() => setShowAllLabels((v) => !v)}
        >
          <Icon name="eye" />
        </button>
        <span className="star-hud-gap" />
        <button
          type="button"
          className={`star-mbtn star-home${homeState === "idle" ? " star-idle" : ""}`}
          data-home={homeState}
          title={home.title}
          onClick={() => stageRef.current?.goHome()}
        >
          <Icon name={home.icon} />
        </button>
        <button
          type="button"
          className={`star-mbtn${popOpen === "settings" ? " star-open" : ""}`}
          title="设置"
          onClick={() => togglePop("settings")}
        >
          <Icon name="settings" />
        </button>
        <button
          type="button"
          className={`star-mbtn${popOpen === "help" ? " star-open" : ""}`}
          title="帮助"
          onClick={() => togglePop("help")}
        >
          <Icon name="help" />
        </button>

        {popOpen === "search" ? (
          <div className="star-pop star-search-pop">
            <input
              type="text"
              placeholder="搜索卡片…"
              autoComplete="off"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {filterActive ? (
              <span className="star-hits">
                命中 {hits.hit} / {hits.total} ·{" "}
                <button type="button" className="star-clear" onClick={clearFilters}>
                  清除
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
        {popOpen === "legend" ? (
          <div className="star-pop star-hud-legend">
            {/* 图例 HTML 来自画布层的 legendHtml（领域名已转义），点选经事件委托 */}
            <div className="star-legend" onClick={onLegendClick} dangerouslySetInnerHTML={{ __html: legendMarkup }} />
            {filterActive ? (
              <div className="star-hits">
                命中 {hits.hit} / {hits.total} ·{" "}
                <button type="button" className="star-clear" onClick={clearFilters}>
                  清除
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {popOpen === "settings" ? (
          <div className="star-pop star-panel">
            {SETTING_ITEMS.map((s) => (
              <label key={s.key}>
                {s.label}
                <span>{s.format(settings[s.key])}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={settings[s.key]}
                  onChange={(e) => applySetting(s.key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        ) : null}
        {popOpen === "help" ? (
          <div className="star-pop star-help" dangerouslySetInnerHTML={{ __html: HELP_HTML }} />
        ) : null}
      </div>
      <div ref={railRef} className="star-rail" />
      </div>

      {/* 没有上盘卡：盘心与环照画，正中叠一句提示 */}
      {isEmpty ? <div className="star-empty">这张盘还没有记录</div> : null}
      </div>

      {/* 侧栏：浮在盘上，不改盘的大小与位置（挡住的地方自己拖开）；工具条让到它左边；分割条可拖 */}
      {openId !== null && side !== null ? (
        <>
          <div
            className="star-split"
            style={{ right: sideWidth - 3 }}
            title="拖动调整侧栏宽度"
            onPointerDown={onSplitPointerDown}
          />
          {/* 按卡身份重建：换一张卡时滚动回到顶部 */}
          <aside key={openId} className="star-side" style={{ width: sideWidth }}>
            <header className="star-side-head">
              <div className="star-side-title">{side.title}</div>
              <div className="star-side-actions">
                <a href={hrefOf(openId)} target="_blank" rel="noopener">
                  在新标签页打开
                </a>
                <button type="button" className="star-mbtn" title="关闭（Esc）" onClick={closeSide}>
                  <Icon name="close" />
                </button>
              </div>
              {side.meta ? <div className="star-side-meta">{side.meta}</div> : null}
            </header>
            <div className="star-side-body" onClick={onSideBodyClick}>
              {side.body}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );

  /** 侧栏要显示的一张卡：标题、元信息行、正文。卡不在这张盘上（地址栏或链接给了不认识的身份）
   * 就在侧栏里如实说明；在盘上却没传正文是盘页的错，直接抛出。 */
  function sideCardOf(id: string): { title: string; meta: string; body: ReactNode } {
    const card = model.byId[id];
    const center = model.center?.id === id ? model.center : null;
    const shown = card ?? center;
    if (!shown) {
      return { title: id, meta: "", body: <p className="star-side-missing">这张盘上没有身份为「{id}」的卡。</p> };
    }
    if (!(id in bodies)) {
      throw new Error(`卡「${id}」没有正文：盘页传给 StarDisk 的 bodies 里缺这一张`);
    }
    const status = center
      ? "根卡"
      : model.supersededIds.has(id)
        ? "被取代"
        : model.isolated.some((c) => c.id === id)
          ? "在立 · 孤星"
          : "在立";
    const meta = [(shown.bornAt ?? "").slice(0, 10), shown.kind, card?.domain, status].filter(Boolean).join(" · ");
    return { title: shown.label, meta, body: bodies[id] };
  }
}
