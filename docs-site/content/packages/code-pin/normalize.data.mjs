/**
 * Normalize（「哈希前先归一化」一节）的数据：站上显示什么就哈希什么。
 * 例子的代码照测试站 full-test/site/src/greet.ts 的实际内容取（返回的是 hello ${name}）；
 * JSDoc 那行是照它的写法拼的（实际文件没有注释），右卡对照里「改一个字的注释」指的就是这一行。
 * 左卡的换行、行尾空白、末尾空行都用可见记号标出（␍␊ 是 CRLF 行尾，· 是空格）；右卡的段哈希是 12 位示意值。
 */

/** 归一化只做三件事：换行统一成 LF、去每行行尾空白、去末尾空行；缩进与注释保留 */
/* ref file="../packages/code-pin/src/core/span.ts" lines="17-22" hash="b691171da610" blob="e9ad52d9b270" */
export const rawLines = [
  '/** 带名字的问候语 */␍␊',
  'export function greet(name: string): string {␍␊',
  '  return `hello ${name}`··␍␊',
  '}␍␊',
  '·',
];

export const normalizedLines = [
  '/** 带名字的问候语 */',
  'export function greet(name: string): string {',
  '  return `hello ${name}`',
  '}',
];

/** 段哈希的 12 位示意值，不是真实算出的值 */
export const hashSample = 'e5f6a7b8c9d0';

export const hashRows = [
  { tone: 'good', left: '只改换行或行尾空格', right: '段哈希不变' },
  { tone: 'warn', left: '改第一行注释的一个字', right: '段哈希变了' },
];
