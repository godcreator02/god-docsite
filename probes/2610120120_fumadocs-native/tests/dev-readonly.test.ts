import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEV_BASE,
  cleanupStrayThreads,
  getPageEventually,
  getDocs,
  postAction,
  spawnServer,
  waitFor,
  type ServerHandle,
} from './helpers';

/** 没有身份码（或码不认得）时：界面只读、接口拒写，两条分别验证 */
describe.each([
  { name: 'dev-readonly-none', env: { DOCSITE_IDENTITY_CODE: undefined }, reason: 'no-identity' },
  { name: 'dev-readonly-unknown', env: { DOCSITE_IDENTITY_CODE: 'not-a-known-code' }, reason: 'identity-unknown' },
])('dev 只读：$reason', ({ name, env, reason }) => {
  let server: ServerHandle;

  beforeAll(async () => {
    cleanupStrayThreads();
    server = spawnServer(name, 'pnpm', ['exec', 'react-router', 'dev', '--port', '5470', '--host', '127.0.0.1'], env);
    await waitFor(() => getDocs(DEV_BASE).then(() => 'up'), { what: 'dev 只读服务就绪', timeoutMs: 120_000 });
  }, 300_000);

  afterAll(async () => {
    await server?.stop();
    cleanupStrayThreads();
  });

  it('界面隐藏写入口并给出只读原因', async () => {
    const html = await getPageEventually(DEV_BASE);
    expect(html).not.toContain('data-new-thread-form');
    expect(html).toContain(`data-readonly-reason="${reason}"`);
    expect(html).toContain('站点只读');
  });

  it('接口拒绝写入（正确 Origin 也一样）', async () => {
    const res = await postAction(DEV_BASE, { intent: 'create-thread', page: 'index.mdx', body: '不应写入' });
    expect(res.status).toBe(403);
    const html = await getPageEventually(DEV_BASE);
    expect(html).not.toContain('不应写入');
    expect(cleanupStrayThreads()).toHaveLength(0);
  });
});
