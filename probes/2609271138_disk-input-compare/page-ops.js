// 在 /trajectory 页面里按固定顺序做一遍操作，每步之后取 .star-disk 的 DOM（数字统一保留 2 位小数），
// 哈希放进 window.__opsResult，全文放进 window.__pageOps。
// 用法：在浏览器工具里先 localStorage.clear() 再刷新页面，然后执行本文件内容，约 90 秒后读 window.__opsResult。
// 侧栏里点卡链接会跳到卡页、脚本随页面一起没了，所以不在这里测。
window.__opsResult = null;
window.__opsError = null;
void (async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = () => wait(1600);
  const root = () => document.querySelector('.star-disk');
  const svg = () => document.querySelector('.star-svg');
  const norm = (html) =>
    html
      .replace(/-?\d+\.\d+(?:e-?\d+)?/g, (n) => Number(n).toFixed(2))
      .replace(/mk-\d+-/g, 'mk-N-');
  const snaps = {};
  const snap = (name) => {
    snaps[name] = norm(root().outerHTML);
  };
  const hash = async (s) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const center = () => {
    const r = svg().getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const btn = (title) => [...document.querySelectorAll('.star-mbtn')].find((b) => b.title === title);
  const setInput = (el, value) => {
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  for (let i = 0; i < 50 && !svg(); i++) await wait(200);
  await settle();
  snap('01-初始');

  const c = center();
  svg().dispatchEvent(new WheelEvent('wheel', { deltaY: -400, clientX: c.x + 60, clientY: c.y - 40, bubbles: true, cancelable: true }));
  await settle();
  snap('02-滚轮放大');

  svg().dispatchEvent(new MouseEvent('mousedown', { clientX: c.x, clientY: c.y, bubbles: true }));
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: c.x + 80, clientY: c.y + 40, bubbles: true }));
  document.dispatchEvent(new MouseEvent('mouseup', { clientX: c.x + 80, clientY: c.y + 40, bubbles: true }));
  await settle();
  snap('03-拖动');

  document.querySelector('.star-home').click();
  await settle();
  snap('04-回到原点一次');

  const nodes = [...document.querySelectorAll('.star-svg g.nd')];
  const node = nodes[Math.floor(nodes.length / 2)];
  node.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  node.dispatchEvent(new PointerEvent('pointermove', { clientX: c.x, clientY: c.y, bubbles: true }));
  await settle();
  snap('05-悬停节点');
  node.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
  await settle();

  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await settle();
  snap('06-点开侧栏');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  snap('08-Esc关侧栏');

  btn('图例与筛选').click();
  await settle();
  snap('09-图例');
  const domainItem = document.querySelector('.star-legend [data-f="domain"]');
  domainItem.click();
  await settle();
  snap('10-按领域筛');
  const formItem = document.querySelector('.star-legend [data-f="form"]');
  formItem.click();
  await settle();
  snap('11-再按形态筛');
  document.querySelector('.star-clear').click();
  await settle();
  btn('图例与筛选').click();
  await settle();

  btn('搜索卡片（label 与卡身份）').click();
  await settle();
  setInput(document.querySelector('.star-search-pop input'), '盘');
  await settle();
  snap('12-搜索');
  setInput(document.querySelector('.star-search-pop input'), '');
  btn('搜索卡片（label 与卡身份）').click();
  await settle();

  btn('全部标签：无视 LOD 全显（重叠也显）').click();
  await settle();
  snap('13-全部标签');
  btn('全部标签：无视 LOD 全显（重叠也显）').click();
  await settle();

  btn('设置').click();
  await settle();
  const ranges = [...document.querySelectorAll('.star-panel input[type=range]')];
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const original = r.value;
    setInput(r, r.min);
    await settle();
    snap(`14-设置${i}-最小`);
    setInput(r, r.max);
    await settle();
    snap(`15-设置${i}-最大`);
    setInput(r, original);
    await settle();
  }
  btn('设置').click();
  await settle();

  document.documentElement.classList.toggle('dark');
  await settle();
  snap('16-切主题');
  document.documentElement.classList.toggle('dark');
  await settle();

  const railInput = document.querySelector('.star-rail input');
  if (railInput) {
    setInput(railInput, 7);
    railInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    snap('17-日期窗收窄');
    svg().dispatchEvent(new WheelEvent('wheel', { deltaY: 200, ctrlKey: true, clientX: c.x, clientY: c.y, bubbles: true, cancelable: true }));
    await settle();
    snap('18-ctrl滚轮时间平移');
  }

  document.querySelector('.star-home').click();
  await settle();
  document.querySelector('.star-home').click();
  await settle();
  snap('19-回到原点两次');

  const hashes = {};
  for (const [k, v] of Object.entries(snaps)) hashes[k] = await hash(v);
  window.__pageOps = snaps;
  window.__opsResult = hashes;
})().catch((err) => {
  window.__opsError = String(err && err.stack ? err.stack : err);
});
