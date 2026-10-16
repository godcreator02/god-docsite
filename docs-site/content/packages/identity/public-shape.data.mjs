/**
 * PublicShape（「identity：身份」那一页「交给浏览器的只有公开形状」一节）的全部数据，画面（public-shape.tsx）只读这一份。
 * 左卡是存在文件里的小周（StoredPerson，字段展开成多行摆——文件里是一项一行的 JSON，展开是为了看清字段）；
 * 中卡照抄 publicPersonOf 的函数体（白名单只抄 id、name、gitea、agent 四项）；
 * 右卡是浏览器拿到的（PublicPerson，没有 codes）。
 * 下面一行的报错原话照 IdentityProvider 抄（源码里的 ${personWithCodes.id} 展开成 zhou）。
 */

/** 存在文件里的形状：小周那一项，为讲解展开成多行（people.json 里是一项一行） */
/* ref file="../packages/identity/src/core/people.ts" lines="10-14" hash="09ed4e92c699" blob="5d0cf38c6fe0" */
export const storedLines = [
  '{',
  '  "id": "zhou",',
  '  "name": "小周",',
  '  "codes": ["zhoucode0001"],',
  '  "gitea": "zhou"',
  '}',
];

/** publicPersonOf 的函数体：按白名单重造一个对象，只抄这四项 */
/* ref file="../packages/identity/src/core/public-people.ts" lines="10-15" hash="3b2ac8620c84" blob="ec5d2ba8b743" */
export const copyLines = [
  'const publicPerson = { id: person.id, name: person.name }',
  'if (person.gitea !== undefined) publicPerson.gitea = person.gitea',
  'if (person.agent !== undefined) publicPerson.agent = person.agent',
  'return publicPerson',
];

/** 浏览器拿到的形状：codes 不会跟着交给浏览器；小周带 gitea，publicPersonOf 会把它抄过去 */
/* ref file="../packages/identity/src/core/public-people.ts" lines="3-7" hash="afe219d6d326" blob="ec5d2ba8b743" */
export const publicLines = ['{', '  "id": "zhou",', '  "name": "小周",', '  "gitea": "zhou"', '}'];

/** 带着 codes 的对象直接交给 IdentityProvider 时，渲染时报的错（原话照源码抄，id 展开成 zhou） */
/* ref file="../packages/identity/src/site/identity-provider.tsx" lines="13-17" hash="7a360b23ca1b" blob="c4b70e217558" */
export const providerError = '交给浏览器的人员列表带着身份码（zhou）：先经 publicPeopleOf 投影';
