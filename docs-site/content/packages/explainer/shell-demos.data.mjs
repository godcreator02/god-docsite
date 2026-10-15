/**
 * 三种外壳的最小例子（「explainer：讲解组件」那一页）的数据，画面（shell-demos.tsx）只读这一份。
 * 三组照 explainer.test.ts 的测试数据写（结构、条数、duration 一样），文字里的「指纹」改成直白的「段哈希」；
 * 机读文字不照抄，由画面运行时调 stepsText 等算出来。
 */
export const steps = [
  { title: '写下引用', text: '文档里记下源码的行段。' },
  { title: '源码改了', text: '那几行的内容变了。' },
  { title: '确认', text: '人看过后写回新的段哈希。' },
];

export const chapters = [
  { title: '开头', text: '什么都还没发生。', duration: 2 },
  { title: '中段', text: '引用开始变黄。', duration: 3 },
];

export const cases = [
  { id: 'fresh', label: '没改', text: '段哈希一致，绿灯。' },
  { id: 'moved', label: '挪了位置', text: '内容还在，只是行号变了。' },
];
