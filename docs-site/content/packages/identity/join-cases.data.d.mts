/** join-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface JoiningPayload {
  /** docsite.people.join 带来的 id 与名字（命令参数 { dir, id, name, gitea? } 里的两项） */
  id: string;
  name: string;
  /** 本 home 的身份码：命令不带它，从设置 identity-code 里取 */
  code: string;
  /** 可选的 Gitea 账号，带了就核对或补上 */
  gitea?: string;
}

export type JoinOutcome =
  /** 名单变了：Diff 只摆变的那一行（加一个人是新的一行，加一个码是那一行变） */
  | { kind: 'joined'; old: string[]; now: string[] }
  /** 码已在这个人名下：不写文件（joinSitePeople 交回 changed: false） */
  | { kind: 'unchanged' }
  /** 被拒：reason 是报错原话 */
  | { kind: 'rejected'; reason: string };

export interface JoinCase {
  id: string;
  label: string;
  text: string;
  joining: JoiningPayload;
  outcome: JoinOutcome;
}

export declare const peopleLines: string[];
export declare const cases: JoinCase[];
