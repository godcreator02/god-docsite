/* 设计文档里的图示公共函数：控制条、时序图。普通脚本（file:// 下不能用 ES 模块），挂在 window.Fig 上 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* 上一步 / 播放 / 下一步。show(i) 由调用方实现，i 从 -1（还没开始）到 n-1 */
  function controls(host, n, show, { interval = 2200, startAt = -1 } = {}) {
    host.classList.add('controls');
    host.innerHTML = '<button data-a="prev">◀ 上一步</button><button data-a="play">▶ 自动播放</button><button data-a="next">下一步 ▶</button><button data-a="reset">↺ 重来</button><span class="count"></span>';
    const count = host.querySelector('.count'), play = host.querySelector('[data-a=play]');
    let cur = startAt, timer = null;
    const go = i => { cur = Math.max(-1, Math.min(n - 1, i)); show(cur); count.textContent = `${cur + 1} / ${n}`; };
    const stop = () => { clearInterval(timer); timer = null; play.textContent = '▶ 自动播放'; };
    host.querySelector('[data-a=prev]').onclick = () => { stop(); go(cur - 1); };
    host.querySelector('[data-a=next]').onclick = () => { stop(); go(cur + 1); };
    host.querySelector('[data-a=reset]').onclick = () => { stop(); go(startAt); };
    play.onclick = () => {
      if (timer) return stop();
      if (cur >= n - 1) go(-1);
      play.textContent = '⏸ 暂停';
      timer = setInterval(() => { if (cur >= n - 1) return stop(); go(cur + 1); }, interval);
    };
    go(startAt);
    return { go, stop };
  }

  /* 时序图。lanes: [{ name, color }]；msgs: [{ from, to, label, note, kind }]，kind 决定箭头颜色 */
  function sequence(root, { lanes, msgs, kinds, width = 880, laneGap, interval }) {
    root.innerHTML = '';
    const ctl = document.createElement('div'); root.appendChild(ctl);
    const box = document.createElement('div'); box.className = 'stage'; root.appendChild(box);
    const cap = document.createElement('div'); cap.className = 'caption'; root.appendChild(cap);
    const gap = laneGap || (width - 140) / Math.max(1, lanes.length - 1);
    const lx = i => 70 + i * gap, y0 = 58, st = 40, h = y0 + st * msgs.length + 14;
    const s = svg('svg', { viewBox: `0 0 ${width} ${h}`, width: '100%', class: 'seq' }, box);
    const defs = svg('defs', {}, s);
    const colors = Object.assign({ plain: 'var(--accent)' }, kinds ? Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.color])) : {});
    for (const k in colors) defs.innerHTML += `<marker id="ah-${k}-${root.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:${colors[k]}"/></marker>`;
    lanes.forEach((l, i) => {
      svg('rect', { x: lx(i) - 70, y: 8, width: 140, height: 28, rx: 6, fill: `color-mix(in srgb, ${l.color} 14%, var(--surface))`, stroke: l.color }, s);
      svg('text', { x: lx(i), y: 27, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, fill: 'var(--text)' }, s, l.name);
      svg('line', { class: 'lane', x1: lx(i), y1: 36, x2: lx(i), y2: h - 4 }, s);
    });
    const els = msgs.map((m, i) => {
      const y = y0 + 10 + i * st, k = m.kind || 'plain', c = colors[k], g = svg('g', { class: 'msg' }, s);
      const mk = `url(#ah-${k}-${root.id})`;
      if (m.from === m.to) {
        svg('path', { d: `M${lx(m.from)},${y - 8} h30 v16 h-28`, stroke: c, 'marker-end': mk }, g);
        svg('text', { x: lx(m.from) + 38, y: y + 4 }, g, m.label);
      } else {
        svg('line', { x1: lx(m.from), y1: y, x2: lx(m.to) + (m.to > m.from ? -4 : 4), y2: y, stroke: c, 'marker-end': mk }, g);
        svg('text', { x: (lx(m.from) + lx(m.to)) / 2, y: y - 6, 'text-anchor': 'middle' }, g, m.label);
      }
      return g;
    });
    const legend = kinds ? '<div class="kinds">' + Object.values(kinds).map(v => `<span><i style="background:${v.color}"></i>${v.name}</span>`).join('') + '</div>' : '';
    controls(ctl, msgs.length, i => {
      els.forEach((g, j) => { g.classList.toggle('show', j <= i); g.classList.toggle('cur', j === i); });
      cap.innerHTML = (i < 0 ? '点「下一步」或「自动播放」。' : `<b>${i + 1}.</b> ${msgs[i].note || ''}`) + legend;
    }, { interval });
  }

  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* 文件浏览器：files: [{ path, lines: [[代码, 标签?, 说明?]] }]；tags: { key: { name, color } } */
  function files(root, { files: list, tags, start = 0 }) {
    root.classList.add('fx');
    root.innerHTML = '<div class="fx-tree"></div><div class="fx-main"><div class="fx-name"></div><div class="fx-code"></div><div class="fx-note"></div></div>';
    const tree = root.querySelector('.fx-tree'), code = root.querySelector('.fx-code'), note = root.querySelector('.fx-note'), name = root.querySelector('.fx-name');
    const legend = '<div class="kinds">' + Object.values(tags).map(v => `<span><i style="background:${v.color}"></i>${v.name}</span>`).join('') + '</div>';
    tree.innerHTML = list.map((f, i) => `<div class="fx-file" data-i="${i}">${esc(f.path)}</div>`).join('');
    function open(i) {
      const f = list[i];
      tree.querySelectorAll('.fx-file').forEach((e, j) => e.classList.toggle('on', j === i));
      name.innerHTML = `<b>${esc(f.path)}</b>${f.desc ? '　<span class="meta">' + f.desc + '</span>' : ''}`;
      code.innerHTML = f.lines.map(([t, tag, n], k) => `<div class="fx-line ${tag ? 'tagged' : ''}" data-k="${k}" style="${tag ? '--t:' + tags[tag].color : ''}">${esc(t) || ' '}</div>`).join('');
      note.innerHTML = '点有颜色的行，看它是谁的代码、借了什么机制。' + legend;
      code.querySelectorAll('.fx-line.tagged').forEach(e => e.onclick = () => {
        code.querySelectorAll('.fx-line').forEach(x => x.classList.remove('sel'));
        e.classList.add('sel');
        const [, tag, n] = f.lines[+e.dataset.k];
        note.innerHTML = `<span class="fx-tag" style="background:${tags[tag].color}">${tags[tag].name}</span> ${n || ''}` + legend;
      });
    }
    tree.querySelectorAll('.fx-file').forEach(e => e.onclick = () => open(+e.dataset.i));
    open(start);
  }

  /* 逐步播放的动画场景。
     draw(s, box) 画出静态部分，并用 box() 画出会动的块（带 key）；块画在原点，位置全由状态里的 x / y 决定。
     状态逐步累加：第 i 步 = init 依次合并 steps[0..i].at。每个 key 的状态：
       x, y 位置；o 透明度；t 换掉块里第一行字；t2 换掉第二行字；hl 高亮（加粗描边、闪一下） */
  function scene(root, { width = 880, height, draw, init = {}, steps, intro = '点「下一步」或「自动播放」。', interval = 2800, onStep }) {
    root.innerHTML = '';
    const ctl = document.createElement('div'); root.appendChild(ctl);
    const stage = document.createElement('div'); stage.className = 'stage scene'; root.appendChild(stage);
    const cap = document.createElement('div'); cap.className = 'caption'; root.appendChild(cap);
    const s = svg('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%' }, stage);
    const defs = svg('defs', {}, s);
    defs.innerHTML = '<marker id="sc-ah-' + root.id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:context-stroke"/></marker>';
    const arrowHead = `url(#sc-ah-${root.id})`;
    const movers = {};
    /* 会动的块：key、宽高、颜色、一行或两行字；plain 不画框，align: 'start' 文字靠左 */
    function box(key, { w, h, color = 'var(--accent)', t = '', t2 = '', fs = 12.5, dashed = false, plain = false, align = 'middle', weight = 600 }) {
      const g = svg('g', { class: 'mv' }, s);
      if (!plain) svg('rect', { width: w, height: h, rx: 7, fill: `color-mix(in srgb, ${color} 14%, var(--surface))`, stroke: color, 'stroke-width': 1.6, 'stroke-dasharray': dashed ? '5 4' : '' }, g);
      const tx = align === 'start' ? 8 : w / 2;
      const t1El = svg('text', { x: tx, y: t2 ? h / 2 - 3 : h / 2 + fs * 0.36, 'text-anchor': align, 'font-size': fs, 'font-weight': weight }, g, t);
      const t2El = svg('text', { x: tx, y: h / 2 + Math.max(13, fs * 0.9),'text-anchor': align, 'font-size': fs - 1.5, fill: 'var(--muted)' }, g, t2);
      movers[key] = { g, t1El, t2El };
      return g;
    }
    /* 只控制位置与显隐的分组：往返回的 g 里画箭头、说明 */
    function group(key) {
      const g = svg('g', { class: 'mv' }, s);
      movers[key] = { g };
      return g;
    }
    draw(s, { box, group, arrowHead });
    function apply(state) {
      for (const key in movers) {
        const m = movers[key], st = state[key] || {};
        m.g.style.transform = `translate(${st.x || 0}px, ${st.y || 0}px)`;
        m.g.style.opacity = st.o ?? 1;
        if (st.t != null) m.t1El.textContent = st.t;
        if (st.t2 != null) m.t2El.textContent = st.t2;        m.g.classList.toggle('hl', !!st.hl);
      }
    }
    /* 第一次摆到初始位置时不播过渡，否则所有块都从左上角飞过来 */
    stage.classList.add('instant');
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('instant')));
    return controls(ctl, steps.length, i => {
      const state = {};
      const merge = at => { for (const k in at) state[k] = Object.assign({}, state[k], at[k]); };
      merge(init);
      for (let j = 0; j <= i; j++) merge(steps[j].at || {});
      /* hl 只在当前这一步有效 */
      for (const k in state) state[k].hl = i >= 0 && !!steps[i].at?.[k]?.hl;
      apply(state);
      cap.innerHTML = i < 0 ? intro : `<b>${i + 1}.</b> ${steps[i].cap}`;
      if (onStep) onStep(i);
    }, { interval });
  }

  window.Fig = { svg, controls, sequence, files, scene, esc };
})();
