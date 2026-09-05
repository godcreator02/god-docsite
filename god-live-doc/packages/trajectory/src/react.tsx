"use client";

/**
 * 客户端组件 StarDisk——星轨盘的 React 壳，只当编排者。
 *
 * 壳管状态与 HUD：容器、工具条、图例、设置 / 帮助 / 搜索浮层、报病数、当前盘与 URL、主题监听、
 * 悬停小气泡、嵌入模式的点击激活。画布是一个空 div，交给整搬的画布层（canvas/stage.ts 照
 * Obsidian 版 star-view 的编排：buildCtx → 六层 build，每帧 place，筛选 / 主题变化 recolor，
 * 帧循环 tick）——React 不画任何 SVG，`renderToStaticMarkup` 那一趟画布区就是空的。
 * 日期竖轨由 DateRail 在壳渲的 `.star-rail` 容器里自建 DOM。
 *
 * 交互范式：滚轮 = 空间缩放指哪缩哪 + 拖拽漫游；ctrl + 滚轮 = 时间平移；竖轨收窄窗即进透镜；
 * 回到原点两段式（相机动过先归相机、再按归窗；Esc 同链）；盘心单击开根卡页、双击回全景；
 * 点节点在新标签页开卡页；点虫洞切盘。嵌入模式保留「点击激活」这一条防页面滚动被吞。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
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
import { inRange } from "./model.ts";
import { toRuntimeModel } from "./serial.ts";
import type { Card, Wormhole } from "./types.ts";
import type { RouteCard, Trajectory } from "./index.ts";

/** StarDisk 的 props：data 是 buildTrajectory 的产物（多盘），hrefBase 是卡页路由前缀
 * （节点链接 = `${hrefBase}/${encodeURIComponent(id)}`）——不收函数，服务端组件传不了函数
 * 给客户端组件。size 给了就按这个边长定容器（同步渲染、不碰 window）；不给就吃满父元素。
 * initialDisk 指定初始显示哪张盘（disks 的 rootId），不在盘清单里就退回第一张。
 *
 * mode 是两种形态：`embed` 方形嵌进文档流（宽随父、高等于宽、点一下才进交互态），
 * `page` 整页（吃满父元素、滚轮直接生效、当前盘写进 URL 的 `?disk=`）。顶栏不归组件画。 */
export interface StarDiskProps {
  data: Trajectory;
  hrefBase: string;
  size?: number;
  initialDisk?: string;
  mode?: "page" | "embed";
}

/** localStorage 里手感参数的键。 */
const SETTINGS_KEY = "live-doc-trajectory.settings";

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
  compass: "M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20z M16 8l-2.5 6L8 16l2.5-6z",
  settings: "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4",
  help: "M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7 M12 17h.01",
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

/** 悬停小气泡的内容：卡或虫洞。 */
interface Tip {
  label: string;
  bornAt: string;
  meta: string;
}

export function StarDisk({ data, hrefBase, size, initialDisk, mode = "embed" }: StarDiskProps): ReactNode {
  /* 整页与嵌入的分支全走这一个布尔：容器几何、激活态、URL 同步 */
  const isPage = mode === "page";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<StarStage | null>(null);
  /** 指针在容器里的最近位置：小气泡摆放用（悬停回调不带坐标） */
  const pointerRef = useRef({ x: 0, y: 0 });

  /* initialDisk 过一道盘清单：它来自 URL 的 `?disk=`，也可能是卡页「回到盘」带来的父卡身份，
   * 不是根卡就没有对应的模型，认下来整盘是空的——认不出就退回第一张盘 */
  const [currentDisk, setCurrentDisk] = useState<string | null>(
    (initialDisk && data.disks.some((d) => d.rootId === initialDisk) ? initialDisk : null) ??
      data.disks[0]?.rootId ??
      null,
  );
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
  /* 交互态：嵌入模式点一下才进（未进滚轮穿透给页面），整页模式恒真——整个视口就是盘 */
  const [clickActivated, setClickActivated] = useState(false);
  const activated = isPage || clickActivated;
  const activeRef = useRef(activated);
  activeRef.current = activated;

  /* ---------- 数据联接：路由卡表（拿 type / milestones），当前盘的运行期模型 ---------- */
  const routeById = useMemo(() => new Map(data.cards.map((c) => [c.id, c])), [data.cards]);
  const serialized = currentDisk ? data.models[currentDisk] : undefined;
  const model = useMemo(() => toRuntimeModel(serialized), [serialized]);
  const rootRoute: RouteCard | undefined = model.root ? routeById.get(model.root.id) : undefined;
  const milestones = useMemo(
    () => (rootRoute?.milestones ? inRange(rootRoute.milestones, model.day0, model.dayMax) : []),
    [rootRoute, model.day0, model.dayMax],
  );
  const typeOf = useCallback((id: string): string | null => routeById.get(id)?.type ?? null, [routeById]);
  const themeName = dark ? "dark" : "light";
  const isEmpty = model.cards.length === 0 && model.wormholes.length === 0;

  /* ---------- 舞台：挂载建一次，随组件存活；数据 / 主题 / 筛选各自经 effect 灌 ---------- */
  const hrefOf = useCallback((id: string) => `${hrefBase}/${encodeURIComponent(id)}`, [hrefBase]);
  const hrefOfRef = useRef(hrefOf);
  hrefOfRef.current = hrefOf;
  const disksRef = useRef(data.disks);
  disksRef.current = data.disks;
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
        /* 点节点 / 盘心：新标签页开卡页 */
        openCard: (id) => {
          window.open(hrefOfRef.current(id), "_blank", "noopener");
        },
        openWormhole: (id) => {
          if (disksRef.current.some((d) => d.rootId === id)) setCurrentDisk(id);
        },
        onHover: (card: Card | null, worm: Wormhole | null) => {
          if (card) {
            setTip({
              label: card.label,
              bornAt: card.bornAt.slice(0, 10),
              meta: `${card.domain} · ${modelRef.current.supersededIds.has(card.id) ? "被取代" : "在立"}`,
            });
          } else if (worm) {
            setTip({ label: worm.label, bornAt: worm.bornAt.slice(0, 10), meta: "虫洞 · 点击穿越到子项目盘" });
          } else setTip(null);
        },
        onHomeState: setHomeState,
        onHits: (hit, total) => setHits({ hit, total }),
        isActive: () => activeRef.current,
      },
      settingsRef.current,
    );
    stageRef.current = stage;
    return () => {
      stage.destroy();
      stageRef.current = null;
    };
  }, []);

  /* 换盘 / 首开：模型灌进舞台，画布整棵重建 */
  useEffect(() => {
    stageRef.current?.setData({ model, milestones, projectId: currentDisk ?? "", typeOf });
    setTip(null);
  }, [model, milestones, currentDisk, typeOf]);

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

  /* ---------- 整页模式：当前盘写进 URL ----------
   * replaceState 不刷新、不进历史栈（切盘是同页状态，不该让浏览器后退键去撤），
   * 只为让「某一张盘」这个位置可以直接分享；初始值由页面从 searchParams 读、经 initialDisk 进来。
   * 搜索词、筛选、透镜位置都不进 URL。 */
  useEffect(() => {
    if (!isPage || !currentDisk) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("disk") === currentDisk) return;
    url.searchParams.set("disk", currentDisk);
    window.history.replaceState(null, "", url);
  }, [isPage, currentDisk]);

  /* ---------- 嵌入模式：点外部释放交互态 ---------- */
  useEffect(() => {
    if (isPage || !activated) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setClickActivated(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isPage, activated]);

  /* ---------- Esc 分层：先收浮层，嵌入模式再退交互态，最后走两段式回原点 ---------- */
  useEffect(() => {
    if (!activated) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (popOpen) {
        setPopOpen(null);
        return;
      }
      if (!isPage) {
        setClickActivated(false);
        return;
      }
      stageRef.current?.goHome();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activated, popOpen, isPage]);

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

  /* 容器几何：整页吃满父元素（高度由页面给），嵌入是宽随父、高等于宽的方块；
   * size 给了就钉死边长（不量尺寸、不碰 window） */
  const style: CSSProperties =
    size !== undefined
      ? { position: "relative", width: size, height: size, overflow: "hidden" }
      : isPage
        ? { position: "relative", width: "100%", height: "100%", overflow: "hidden" }
        : { position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 12 };
  const shellClass = `star-disk${isPage ? " star-disk-page" : ""}${dark ? " star-dark" : ""}${activated ? " star-active" : ""}`;
  const home = HOME_FACE[homeState];
  const hubLabel = model.root?.label ?? currentDisk ?? "";

  return (
    <div
      ref={containerRef}
      className={shellClass}
      style={style}
      onPointerMove={onPointerMove}
      onPointerDown={() => {
        if (!isPage) setClickActivated(true);
      }}
    >
      {/* 画布区：空 div 交给画布层，svg 由舞台建；竖轨容器在它左缘 */}
      <div ref={canvasRef} className="star-canvas" data-disk={currentDisk ?? ""} aria-label={hubLabel} />
      <div ref={railRef} className="star-rail" />

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

      {/* 右上工具条：左簇 搜索 / 图例 / 全部标签，右簇 回到原点 / 设置 / 帮助 */}
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

      {/* 嵌入模式未激活：一条提示带，不遮盘（点盘任何地方即激活） */}
      {!activated ? <span className="star-activate-hint">点击进入盘面</span> : null}
      {isEmpty && !currentDisk ? <div className="star-empty">还没有任何盘</div> : null}
    </div>
  );
}
