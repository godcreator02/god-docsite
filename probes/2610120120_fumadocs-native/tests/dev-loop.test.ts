import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  COMMENTS_DIR,
  DEV_BASE,
  SEED_THREAD,
  cleanupStrayThreads,
  getPageEventually,
  getDocs,
  postAction,
  replyIdsOf,
  spawnServer,
  waitNewReplyFile,
  waitNewThreadDir,
  waitPageContains,
  waitFor,
  type ServerHandle,
} from './helpers';

let server: ServerHandle;

beforeAll(async () => {
  cleanupStrayThreads();
  server = spawnServer('dev-loop', 'pnpm', ['exec', 'react-router', 'dev', '--port', '5470', '--host', '127.0.0.1'], {
    DOCSITE_IDENTITY_CODE: 'probe-code-owner',
  });
  await waitFor(() => getDocs(DEV_BASE).then(() => 'up'), { what: 'dev 服务就绪', timeoutMs: 120_000 });
}, 300_000);

afterAll(async () => {
  await server?.stop();
  const strays = cleanupStrayThreads();
  if (strays.length > 0) console.log('已清理测试残留评论串:', strays.join(', '));
});

describe('dev：SSR 只读面（loader 只交付本页评论元数据，正文含同目录 TSX/图片）', () => {
  it('页面正文按需入口 SSR 渲染（loader 只传路径，正文经 useContent 渲染）', async () => {
    const html = await getPageEventually(DEV_BASE);
    expect(html).toContain('第一页');
    expect(html).toContain('同一个编译器');
  });

  it('样例评论串：串头 MDX、同目录 TSX 组件、图片、回复都经同一编译链', async () => {
    const html = await getPageEventually(DEV_BASE);
    expect(html).toContain('样例评论串：这一条带同目录的交互组件和图片');
    expect(html).toContain('data-comment-counter');
    expect(html).toContain('评论内组件点击次数');
    expect(html).toMatch(/<img[^>]*src="\/comments\/20261012t080000-seed1\/dot\.png"/);
    expect(html).toContain('回复：同目录图片与组件都能显示的话');
    expect(html).toContain('data-comments-sidebar');
    expect(html).toContain('站长');
    expect(html).toContain('小周');
  });

  it('评论图片资源可取', async () => {
    const res = await fetch(`${DEV_BASE}/comments/${SEED_THREAD}/dot.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
  });

  it('旁栏可写：显示新建表单，不显示只读原因', async () => {
    const html = await getPageEventually(DEV_BASE);
    expect(html).toContain('data-new-thread-form');
    expect(html).not.toContain('data-readonly-reason');
  });
});

describe('dev：写闭环（action → 文件 → 集合更新 → SSR 反映）', () => {
  let threadId = '';
  let replyId = '';
  // 注意断言不能用带 **加粗** 的整句：MDX 渲染成 <strong> 后原句被拆开
  const threadBodyPlain = 'Vitest 写入的第一条评论串，含中文与';
  const threadBodyBold = '<strong>加粗</strong>';
  const replyBody = 'Vitest 写入的回复。';
  const assistantReply = 'assistant 署名的回复。';

  it('新建评论串：action 200、串文件夹落盘、SSR 随后出现该串', async () => {
    const res = await postAction(DEV_BASE, {
      intent: 'create-thread',
      page: 'index.mdx',
      body: 'Vitest 写入的第一条评论串，含中文与**加粗**。',
    });
    expect(res.status).toBe(200);
    threadId = await waitNewThreadDir('新建评论串落盘');
    await waitPageContains(DEV_BASE, threadBodyPlain, true, '新评论串出现在 SSR');
    await waitPageContains(DEV_BASE, threadBodyBold, true, 'MDX 加粗生效');
  });

  it('回复：action 200、回复文件落盘、SSR 随后出现该回复', async () => {
    const known = new Set(replyIdsOf(threadId));
    const res = await postAction(DEV_BASE, { intent: 'reply', threadId, body: replyBody });
    expect(res.status).toBe(200);
    replyId = await waitNewReplyFile(threadId, known, '回复文件落盘');
    await waitPageContains(DEV_BASE, replyBody, true, '回复出现在 SSR');
  });

  it('agent 以 as 署名写入：目标必须是 agent 人员', async () => {
    const known = new Set(replyIdsOf(threadId));
    const res = await postAction(DEV_BASE, { intent: 'reply', threadId, as: 'assistant', body: assistantReply });
    expect(res.status).toBe(200);
    await waitNewReplyFile(threadId, known, 'assistant 回复落盘');
    await waitPageContains(DEV_BASE, assistantReply, true, 'assistant 回复出现在 SSR');
    const html = await getPageEventually(DEV_BASE);
    expect(html).toContain('data-thread-author="站长"');
    expect(html).toMatch(/data-reply-author="[^"]*"[^>]*>\s*助手/s);
  });

  it('删回复：action 200、文件消失、SSR 随后不再包含该回复', async () => {
    const res = await postAction(DEV_BASE, { intent: 'delete-reply', threadId, replyId });
    expect(res.status).toBe(200);
    await waitFor(() => (replyIdsOf(threadId).includes(replyId) ? undefined : 'gone'), {
      what: '回复文件删除',
      timeoutMs: 15_000,
    });
    await waitPageContains(DEV_BASE, replyBody, false, '回复从 SSR 消失');
  });

  it('删整串：action 200、文件夹消失、SSR 随后不再包含该串', async () => {
    const res = await postAction(DEV_BASE, { intent: 'delete-thread', threadId });
    expect(res.status).toBe(200);
    await waitFor(() => (existsSync(path.join(COMMENTS_DIR, threadId)) ? undefined : 'gone'), {
      what: '评论串文件夹删除',
      timeoutMs: 15_000,
    });
    await waitPageContains(DEV_BASE, threadBodyPlain, false, '评论串从 SSR 消失');
  });
});

describe('dev：写入保护（身份/来源/as 校验）', () => {
  it('缺 Origin 的写请求被拒绝', async () => {
    const res = await postAction(DEV_BASE, { intent: 'create-thread', page: 'index.mdx', body: '不应写入' }, { origin: null });
    expect(res.status).toBe(403);
    const html = await getPageEventually(DEV_BASE);
    expect(html).not.toContain('不应写入');
  });

  it('跨站 Origin 被拒绝', async () => {
    const res = await postAction(
      DEV_BASE,
      { intent: 'create-thread', page: 'index.mdx', body: '不应写入' },
      { origin: 'http://evil.example' },
    );
    expect([400, 403]).toContain(res.status);
    const html = await getPageEventually(DEV_BASE);
    expect(html).not.toContain('不应写入');
  });

  it('as 指向不存在的人被拒绝（403，无文件落盘）', async () => {
    const res = await postAction(DEV_BASE, { intent: 'create-thread', page: 'index.mdx', as: 'nobody', body: 'x' });
    expect(res.status).toBe(403);
    expect(cleanupStrayThreads()).toHaveLength(0);
  });

  it('as 指向非 agent 人员被拒绝（403，无文件落盘）', async () => {
    const res = await postAction(DEV_BASE, { intent: 'create-thread', page: 'index.mdx', as: 'zhou', body: 'x' });
    expect(res.status).toBe(403);
    expect(cleanupStrayThreads()).toHaveLength(0);
  });

  it('未知 intent 与坏 id 被拒绝', async () => {
    const unknown = await postAction(DEV_BASE, { intent: 'nonsense' });
    expect(unknown.status).toBe(400);
    const badId = await postAction(DEV_BASE, { intent: 'delete-thread', threadId: '../evil' });
    expect(badId.status).toBe(400);
    expect(cleanupStrayThreads()).toHaveLength(0);
  });
});
