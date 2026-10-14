import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  COMMENT_ID_PATTERN,
  newCommentId,
  serializeCommentFile,
  threadsForPage,
} from '../src/core/index.js';
import { createReply, createThread, deleteReply, deleteThread, readCommentThreads } from '../src/node/index.js';

const PROBE_ROOT = process.cwd();
const tmpRoot = path.join(PROBE_ROOT, '.tmp-model');

function freshDir(name: string): string {
  const dir = path.join(tmpRoot, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('评论模型：id 与序列化', () => {
  it('newCommentId 符合形状且可排序', () => {
    const a = newCommentId(new Date('2026-10-12T08:00:00'));
    const b = newCommentId(new Date('2026-10-12T09:00:00'));
    expect(a).toMatch(COMMENT_ID_PATTERN);
    expect(b).toMatch(COMMENT_ID_PATTERN);
    expect(a < b).toBe(true);
  });

  it('frontmatter 值按 JSON 字符串写出，正文收尾', () => {
    const file = serializeCommentFile({ page: 'index.mdx', author: 'owner', createdAt: '2026-10-12T08:00:00.000Z' }, '正文\n');
    expect(file).toBe('---\npage: "index.mdx"\nauthor: "owner"\ncreatedAt: "2026-10-12T08:00:00.000Z"\n---\n\n正文\n');
  });
});

describe('评论模型：threadsForPage 分组', () => {
  it('只留本页的串；回复按文件名排序', () => {
    const threads = threadsForPage(
      [
        { path: '20261012t080000-seed1/index.mdx', authorId: 'owner', createdAt: '2026-10-12T08:00:00.000Z', page: 'index.mdx' },
        { path: '20261012t080000-seed1/20261012t080500-r1a2.mdx', authorId: 'zhou', createdAt: '2026-10-12T08:05:00.000Z' },
        { path: '20261012t080000-seed1/20261012t080200-b001.mdx', authorId: 'zhou', createdAt: '2026-10-12T08:02:00.000Z' },
        { path: '20261012t090000-other/index.mdx', authorId: 'owner', createdAt: '2026-10-12T09:00:00.000Z', page: 'guide/other.mdx' },
      ],
      'index.mdx',
    );
    expect(threads).toHaveLength(1);
    expect(threads[0]?.id).toBe('20261012t080000-seed1');
    expect(threads[0]?.replies).toHaveLength(2);
    expect(threads[0]?.replies.map((r) => r.id)).toEqual(['20261012t080200-b001', '20261012t080500-r1a2']);
  });

  it('串头缺失（回复无主）直接抛错并点名路径', () => {
    expect(() =>
      threadsForPage([{ path: '20261012t080000-seed1/20261012t080500-r1a2.mdx', authorId: 'zhou', createdAt: 'x' }], 'index.mdx'),
    ).toThrow(/index\.mdx/);
  });

  it('不属于任何串文件夹的条目抛错', () => {
    expect(() =>
      threadsForPage([{ path: 'loose.mdx', authorId: 'a', createdAt: 'x', page: 'index.mdx' }], 'index.mdx'),
    ).toThrow(/串文件夹/);
  });
});

describe('评论模型：真实文件写入与删除', () => {
  it('createThread → createReply → deleteReply → deleteThread 全链', async () => {
    const dir = freshDir('lifecycle');
    const created = await createThread(dir, { page: 'index.mdx', authorId: 'owner', body: '串头正文' });
    expect(COMMENT_ID_PATTERN.test(created.id)).toBe(true);
    const headFile = path.join(dir, created.id, 'index.mdx');
    expect(readFileSync(headFile, 'utf-8')).toContain('串头正文');
    expect(readFileSync(headFile, 'utf-8')).toContain(`page: "index.mdx"`);

    const reply = await createReply(dir, created.id, { authorId: 'zhou', body: '回复正文' });
    expect(existsSync(path.join(dir, created.id, `${reply.id}.mdx`))).toBe(true);

    // 附件与串同目录，删串时一并删除
    writeFileSync(path.join(dir, created.id, 'extra.txt'), 'x');

    await deleteReply(dir, created.id, reply.id);
    expect(existsSync(path.join(dir, created.id, `${reply.id}.mdx`))).toBe(false);

    const removed = await deleteThread(dir, created.id);
    expect(removed.sort()).toEqual(['index.mdx', 'extra.txt'].sort().map((f) => `${created.id}/${f}`));
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('非法 threadId / replyId（含路径穿越）被形状校验拒绝', async () => {
    const dir = freshDir('guards');
    await expect(createThread(dir, { page: 'p', authorId: 'a', body: 'x' })).resolves.toBeDefined();
    const [threadId] = readdirSync(dir);
    await expect(createReply(dir, '../escape', { authorId: 'a', body: 'x' })).rejects.toThrow(/不是合法/);
    await expect(deleteReply(dir, threadId!, '../../evil')).rejects.toThrow(/不是合法/);
    await expect(deleteThread(dir, '..%2Fevil')).rejects.toThrow(/不是合法/);
  });

  it('空正文、空作者、目标串不存在都直接拒绝', async () => {
    const dir = freshDir('rejects');
    await expect(createThread(dir, { page: 'p', authorId: '', body: 'x' })).rejects.toThrow(/authorId/);
    await expect(createThread(dir, { page: 'p', authorId: 'a', body: '  ' })).rejects.toThrow(/正文/);
    await expect(createReply(dir, '20261012t080000-nope', { authorId: 'a', body: 'x' })).rejects.toThrow(/不存在/);
    await expect(deleteThread(dir, '20261012t080000-nope')).rejects.toThrow(/不存在/);
  });
});

describe('锚点（anchor）：评论串可锚定页面元素 id', () => {
  it('threadsForPage 把串头的 anchor 带进结果；没有 anchor 的串不带这个字段', () => {
    const anchored = threadsForPage(
      [
        { path: '20261012t080000-a1/index.mdx', page: 'index.mdx', authorId: 'owner', createdAt: '2026-10-12T08:00:00.000Z', anchor: '正文一段' },
        { path: '20261012t080100-a2/index.mdx', page: 'index.mdx', authorId: 'owner', createdAt: '2026-10-12T08:01:00.000Z' },
      ],
      'index.mdx',
    );
    expect(anchored).toHaveLength(2);
    expect(anchored[0]!.anchor).toBe('正文一段');
    expect(anchored[1]!.anchor).toBeUndefined();
  });

  it('createThread 带 anchor 时写进 frontmatter；空串与省略都不写', async () => {
    const dir = freshDir('anchor');
    await createThread(dir, { page: 'index.mdx', authorId: 'owner', body: '带锚点', anchor: 'some-heading' });
    await createThread(dir, { page: 'index.mdx', authorId: 'owner', body: '空串', anchor: '' });
    // 两个串同一秒建出来，文件夹名排序不区分先后：按正文找各自的串头
    const files = readdirSync(dir).map((name) => readFileSync(path.join(dir, name, 'index.mdx'), 'utf-8'));
    const withAnchor = files.find((content) => content.includes('带锚点'))!;
    const withoutAnchor = files.find((content) => content.includes('空串'))!;
    expect(withAnchor).toMatch(/^anchor: "some-heading"$/m);
    expect(withoutAnchor).not.toMatch(/^anchor:/m);
  });
});

describe('readCommentThreads：插件用的磁盘读取', () => {
  it('读出串头与回复的 frontmatter 与正文；跳过非评论目录', async () => {
    const dir = freshDir('read-threads')
    await createThread(dir, { page: 'index.mdx', authorId: 'owner', body: '串头正文' })
    const [threadId] = readdirSync(dir)
    await createReply(dir, threadId!, { authorId: 'zhou', body: '回复正文' })
    writeFileSync(path.join(dir, 'not-a-thread.mdx'), 'x')
    const threads = await readCommentThreads(dir)
    expect(threads).toHaveLength(1)
    expect(threads[0]!.head.page).toBe('index.mdx')
    expect(threads[0]!.head.body).toContain('串头正文')
    expect(threads[0]!.replies).toHaveLength(1)
    expect(threads[0]!.replies[0]!.body).toContain('回复正文')
  })
})
