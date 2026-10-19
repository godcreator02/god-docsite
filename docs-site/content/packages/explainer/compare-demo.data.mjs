/**
 * 对比表放进动画的例子（「explainer：讲解组件」那一页）的数据，画面（compare-demo.tsx）只读这一份。
 * 拿三种外壳自己当例子：每一章讲一行，栏是三种外壳；格里的字照本页「三种外壳」一节写。
 */
export const columns = [
  { title: '分步 Stepper', role: 'blue' },
  { title: '动画 Timeline', role: 'violet' },
  { title: '选情况 CasePicker', role: 'emerald' },
];

export const rows = [
  { label: '用于', cells: ['有先后的过程', '时间连续的过程', '同一规则下几种情况'] },
  { label: '控制条中间', cells: ['一排步号', '横条与章节刻度', '一排胶囊，没有播放键'] },
  { label: '画面拿到', cells: ['(step, index)', '{ time, chapter, index, progress }', '(item)'] },
  { label: '机读文字', cells: ['stepsText', 'chaptersText', 'casesText'] },
];

export const chapters = [
  { title: '用于', text: '先看三种外壳各讲什么样的过程。', duration: 3 },
  { title: '控制条', text: '控制条位置一样，只有中间那一格不同。', duration: 3 },
  { title: '画面函数', text: '页面只写画面函数，三种外壳交给它的参数不同。', duration: 3 },
  { title: '机读文字', text: '放进生成正本时，各有一个函数把数据转成段落。', duration: 3 },
];
