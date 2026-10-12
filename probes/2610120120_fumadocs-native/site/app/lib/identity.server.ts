import { people, personByCode } from './people.server';
import type { NamedAuthor } from './comments.server';
import type { ReadOnlyReason } from './read-only-reasons';

/**
 * 身份与写入边界（M3/K-07）：
 * - 身份码由启动方经环境变量注入；没有码（或码不在 people.json 里）就是只读，不看运行模式。
 * - 写接口核对请求来源：Origin 必须等于站点自己的 origin，缺 Origin 也拒绝。
 * - agent 用 as 声明署名：目标必须是人员列表里 agent: true 的人。
 * 授权通过后，站点把可信的 {id,name} 交给评论模型；模型不认识这些概念。
 */

const identityCode = process.env.DOCSITE_IDENTITY_CODE ?? '';

export interface IdentityStatus {
  writable: boolean;
  writer: NamedAuthor | null;
  /** 界面显示用：只读原因（接口侧另有同样的拒绝，两者分开验） */
  readOnlyReason: ReadOnlyReason | null;
  /** 可选署名：本人 + agent 人员 */
  asChoices: NamedAuthor[];
}

export function identityStatus(): IdentityStatus {
  const person = identityCode ? personByCode(identityCode) : undefined;
  if (!person) {
    return {
      writable: false,
      writer: null,
      readOnlyReason: identityCode ? 'identity-unknown' : 'no-identity',
      asChoices: [],
    };
  }
  const asChoices: NamedAuthor[] = [
    { id: person.id, name: person.name },
    ...people.filter((p) => p.agent && p.id !== person.id).map((p) => ({ id: p.id, name: p.name })),
  ];
  return { writable: true, writer: { id: person.id, name: person.name }, readOnlyReason: null, asChoices };
}

/** 校验失败返回错误码；成功返回应记在评论上的作者 */
export function resolveAuthor(form: FormData): { author: NamedAuthor } | { error: 'as-unknown' | 'as-not-agent' } {
  const person = identityCode ? personByCode(identityCode) : undefined;
  if (!person) throw new Error('resolveAuthor 只在身份校验通过后调用');
  const as = form.get('as');
  if (typeof as !== 'string' || as === '') {
    return { author: { id: person.id, name: person.name } };
  }
  const target = people.find((p) => p.id === as);
  if (!target) return { error: 'as-unknown' };
  if (target.agent !== true) return { error: 'as-not-agent' };
  return { author: { id: target.id, name: target.name } };
}

/** 写接口的来源核对：Origin 头必须存在且等于站点自己的 origin */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return false;
  return origin === new URL(request.url).origin;
}
