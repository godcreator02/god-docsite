/**
 * 评论界面：页面旁的评论列表与编辑器（新建整页评论、回复、删回复、删串）。
 *
 * 与宿主的分工：宿主路由的 loader 组装本页评论元数据（作者已解析成可信的 {id,name}），
 * action 承接写意图；这里的表单按约定字段 POST 到当前路由：
 *   intent=create-thread：page、body、anchor?（批整页不带）
 *   intent=reply：threadId、body
 *   intent=delete-reply：threadId、replyId
 *   intent=delete-thread：threadId
 * action 的返回约定 { ok: true, … } 或 { ok: false, error: 文案 }（失败随状态码）。
 * 身份与授权在 @godcreator/docsite-identity，本组件只接收结果（writable/只读文案），
 * 不认识身份码；头像也不依赖它——宿主把它包成 AvatarComponent 传进来（CommentsDock 同样往下传）。
 * 署名（as）只给 agent 经命令用，网页界面里不出现。
 * 评论正文由宿主编译（fumadocs-mdx 集合），经 BodyComponent 按路径渲染。
 */
import { Component, useEffect, useState, type ComponentType, type MouseEvent, type ReactNode } from 'react';
import { useFetcher } from 'react-router';

/** 评论作者：宿主解析过的可信组合（模型文件里存的是 authorId 字符串） */
export interface CommentWriter {
  id: string;
  name: string;
}

export interface PageThreadReplySummary {
  id: string;
  /** 相对评论集合目录的路径，交给 BodyComponent 渲染正文 */
  path: string;
  author: CommentWriter;
  createdAt: string;
}

export interface PageThreadSummary {
  id: string;
  headPath: string;
  /** 锚定的目标：元素 id、划字评论的 JSON（见模型 parseCommentAnchor）或缺省（批整页） */
  anchor?: string;
  /** 落点状态写给人看（「原文找不到了：……」）：由 CommentsDock 按正文实测补上 */
  anchorNote?: string;
  author: CommentWriter;
  createdAt: string;
  replies: PageThreadReplySummary[];
}

/** 本页评论的写入口状态：可写或只读（原因给界面与测试用） */
export type CommentsAccess =
  | { kind: 'writable'; writer: CommentWriter }
  | { kind: 'readonly'; reasonCode: string; reasonText: string };

/** 头像组件的形状：宿主从身份包把 Avatar 包一层传进来（评论包不依赖身份包） */
export type CommentAvatar = ComponentType<CommentWriter & { size?: number }>;

/** action 返回形状的运行时收窄（评论台里的草稿表单也用） */
export function errorOf(data: unknown): string | null {
  if (data !== null && typeof data === 'object' && 'ok' in data && (data as { ok: unknown }).ok === false) {
    const error = (data as { error?: unknown }).error;
    return typeof error === 'string' ? error : '写入被拒绝';
  }
  return null;
}

const fullTime = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const minute = 60_000

/** 刚刚、几分钟前、几小时前、几天前，再早写日期；整时间停在 time 的 title 上 */
function relativeTime(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime()
  if (elapsed < minute) return '刚刚'
  if (elapsed < 60 * minute) return `${Math.floor(elapsed / minute)} 分钟前`
  if (elapsed < 24 * 60 * minute) return `${Math.floor(elapsed / (60 * minute))} 小时前`
  if (elapsed < 7 * 24 * 60 * minute) return `${Math.floor(elapsed / (24 * 60 * minute))} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

export interface CommentsSidebarProps {
  pagePath: string;
  threads: PageThreadSummary[];
  access: CommentsAccess;
  /** 宿主的评论正文组件：按集合内路径渲染（fumadocs 的 client loader），正文按需加载 */
  BodyComponent: ComponentType<{ path: string }>;
  /** 宿主的头像组件（可省，省了就不画头像） */
  AvatarComponent?: CommentAvatar;
  /** 激活的评论串（与正文标记联动）：命中时行高亮 */
  activeThreadId?: string | null;
  /** 点某一行时通知宿主（宿主滚到被批的元素或那段字） */
  onThreadActivate?: (threadId: string) => void;
  /** 宿主接的展示插槽（当前身份标识这类宿主自己的东西） */
  headerSlot?: ReactNode;
}

export function CommentsSidebar({
  pagePath,
  threads,
  access,
  BodyComponent,
  AvatarComponent,
  activeThreadId = null,
  onThreadActivate,
  headerSlot,
}: CommentsSidebarProps) {
  return (
    <aside data-comments-sidebar data-comment-count={threads.length} className="docsite-comments-sidebar">
      <div className="docsite-comments-header">
        <h2 className="docsite-comments-title">本页评论</h2>
        <span className="docsite-comments-count">{threads.length} 串</span>
        {headerSlot}
      </div>
      {access.kind === 'writable' ? (
        <NewThreadForm pagePath={pagePath} />
      ) : (
        <p data-readonly-reason={access.reasonCode} className="docsite-readonly-reason">
          {access.reasonText}
        </p>
      )}
      {threads.map((thread) => (
        <ThreadRow
          key={thread.id}
          thread={thread}
          writable={access.kind === 'writable'}
          BodyComponent={BodyComponent}
          AvatarComponent={AvatarComponent}
          active={thread.id === activeThreadId}
          onActivate={onThreadActivate}
        />
      ))}
    </aside>
  );
}

/** 一行里作者信息的排法：头像、名字、相对时间；挂起时才露出删除等操作 */
function CommentHeading({
  author,
  createdAt,
  AvatarComponent,
  avatarSize,
  actions,
}: {
  author: CommentWriter;
  createdAt: string;
  AvatarComponent?: CommentAvatar;
  avatarSize: number;
  actions?: ReactNode;
}) {
  return (
    <div className="docsite-comment-heading">
      {AvatarComponent ? <AvatarComponent {...author} size={avatarSize} /> : null}
      <span className="docsite-comment-authorname">{author.name}</span>
      <time dateTime={createdAt} title={fullTime.format(new Date(createdAt))} className="docsite-comment-time">
        {relativeTime(createdAt)}
      </time>
      {actions ? <span className="docsite-comment-actions">{actions}</span> : null}
    </div>
  );
}

/** 新建整页评论：平时收成一行按钮，点了展开表单；发出去了收起并清空 */
function NewThreadForm({ pagePath }: { pagePath: string }) {
  const fetcher = useFetcher();
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState('');
  const error = errorOf(fetcher.data);
  const sent = fetcher.state === 'idle' && (fetcher.data as { ok?: boolean } | undefined)?.ok === true
  useEffect(() => {
    if (sent) {
      setWriting(false)
      setBody('')
    }
  }, [sent])
  if (!writing) {
    return (
      <button type="button" data-new-thread-toggle className="docsite-new-thread-toggle" onClick={() => setWriting(true)}>
        ＋ 评论整页
      </button>
    );
  }
  return (
    <fetcher.Form method="post" data-new-thread-form className="docsite-new-thread">
      <input type="hidden" name="intent" value="create-thread" />
      <input type="hidden" name="page" value={pagePath} />
      <textarea name="body" required rows={3} placeholder="写评论（支持 MDX）" value={body} onChange={(event) => setBody(event.target.value)} />
      <div className="docsite-form-row">
        <span />
        <button type="submit" disabled={fetcher.state !== 'idle'}>
          {fetcher.state !== 'idle' ? '写入中…' : '发评论'}
        </button>
      </div>
      {error ? <p data-action-error>{error}</p> : null}
    </fetcher.Form>
  );
}

function ThreadRow({
  thread,
  writable,
  BodyComponent,
  AvatarComponent,
  active,
  onActivate,
}: {
  thread: PageThreadSummary;
  writable: boolean;
  BodyComponent: ComponentType<{ path: string }>;
  AvatarComponent?: CommentAvatar;
  active: boolean;
  onActivate?: (threadId: string) => void;
}) {
  const fetcher = useFetcher();
  const error = errorOf(fetcher.data);
  /** 展开看全部回复与回复框；收着时整行只是预览，点行跳到正文里被批的位置 */
  const [expanded, setExpanded] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const replySent = fetcher.state === 'idle' && (fetcher.data as { ok?: boolean; intent?: string } | undefined)?.ok === true && (fetcher.data as { intent?: string }).intent === 'reply'
  useEffect(() => {
    if (replySent) setReplyBody('')
  }, [replySent])
  const onRowClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('a, button, textarea, select, input, label')) return
    onActivate?.(thread.id)
  }
  return (
    <section
      data-comment-card={thread.id}
      className={active ? 'docsite-comment-row docsite-comment-row-active' : 'docsite-comment-row'}
      onClick={onRowClick}
    >
      {thread.anchorNote ? (
        <p data-thread-note="" className="docsite-thread-note">
          {thread.anchorNote}
        </p>
      ) : null}
      <CommentHeading
        author={thread.author}
        createdAt={thread.createdAt}
        AvatarComponent={AvatarComponent}
        avatarSize={20}
        actions={
          writable ? (
            <>
              <button type="button" data-open-replies={thread.id} title="展开这一串，写回复" onClick={() => setExpanded(true)}>
                回复
              </button>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete-thread" />
                <input type="hidden" name="threadId" value={thread.id} />
                <button type="submit" data-delete-thread={thread.id} title="删除整串（含回复）">
                  删除
                </button>
              </fetcher.Form>
            </>
          ) : null
        }
      />
      <div className={expanded ? 'docsite-row-body' : 'docsite-row-body docsite-row-body-clamped'}>
        <CommentBody BodyComponent={BodyComponent} path={thread.headPath} />
      </div>
      {thread.replies.length > 0 ? (
        <button type="button" className="docsite-replies-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起回复' : `展开 ${thread.replies.length} 条回复`}
        </button>
      ) : null}
      {expanded ? (
        <div className="docsite-row-replies">
          {thread.replies.map((reply) => (
            <div key={reply.id} data-reply={reply.id} className="docsite-reply">
              <CommentHeading
                author={reply.author}
                createdAt={reply.createdAt}
                AvatarComponent={AvatarComponent}
                avatarSize={16}
                actions={
                  writable ? (
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete-reply" />
                      <input type="hidden" name="threadId" value={thread.id} />
                      <input type="hidden" name="replyId" value={reply.id} />
                      <button type="submit" data-delete-reply={reply.id} title="删除这条回复">
                        删除
                      </button>
                    </fetcher.Form>
                  ) : null
                }
              />
              <CommentBody BodyComponent={BodyComponent} path={reply.path} />
            </div>
          ))}
          {writable ? (
            <fetcher.Form method="post" data-reply-form={thread.id} className="docsite-reply-form">
              <input type="hidden" name="intent" value="reply" />
              <input type="hidden" name="threadId" value={thread.id} />
              <textarea name="body" required rows={2} placeholder="写回复（支持 MDX）" value={replyBody} onChange={(event) => setReplyBody(event.target.value)} />
              <div className="docsite-form-row">
                <span />
                <button type="submit" disabled={fetcher.state !== 'idle'}>
                  {fetcher.state !== 'idle' ? '写入中…' : '回复'}
                </button>
              </div>
            </fetcher.Form>
          ) : null}
        </div>
      ) : null}
      {error ? <p data-action-error>{error}</p> : null}
    </section>
  );
}

/**
 * dev 下刚写入的评论：服务端清单已更新，浏览器里已加载的集合入口还没有它的模块，
 * 正文组件会抛「does not exist」；Vite 重新生成入口后整页刷新即恢复。
 * 这里用每条评论一个错误边界兜住这个窗口，不改正文、不碰框架。
 */
class CommentBodyBoundary extends Component<{ path: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <p data-comment-pending className="docsite-comment-pending">
          这条评论刚写入，等浏览器拿到编译入口后显示（刷新页面）。
        </p>
      );
    }
    return this.props.children;
  }
}

function CommentBody({ path, BodyComponent }: { path: string; BodyComponent: ComponentType<{ path: string }> }) {
  return (
    <CommentBodyBoundary key={path} path={path}>
      <BodyComponent path={path} />
    </CommentBodyBoundary>
  );
}
