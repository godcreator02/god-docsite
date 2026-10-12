/**
 * 评论界面：页面旁的评论列表与编辑器（新建、回复、删回复、删串）。
 *
 * 与宿主的分工：宿主路由的 loader 组装本页评论元数据（作者已解析成可信的 {id,name}），
 * action 承接写意图；这里的表单按约定字段 POST 到当前路由：
 *   intent=create-thread：page、body、anchor?、as?
 *   intent=reply：threadId、body、as?
 *   intent=delete-reply：threadId、replyId
 *   intent=delete-thread：threadId
 * action 的返回约定 { ok: true, … } 或 { ok: false, error: 文案 }（失败随状态码）。
 * 身份与授权在 @godcreator/docsite-identity，本组件只接收结果（writable/asChoices/只读文案），
 * 不认识身份码。评论正文由宿主编译（fumadocs-mdx 集合），经 BodyComponent 按路径渲染。
 */
import { Component, type ComponentType, type ReactNode } from 'react';
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
  /** 锚定的页面元素 id；页面级评论没有 */
  anchor?: string;
  author: CommentWriter;
  createdAt: string;
  replies: PageThreadReplySummary[];
}

/** 本页评论的写入口状态：可写（本人 + 可代署名的 agent）或只读（原因给界面与测试用） */
export type CommentsAccess =
  | { kind: 'writable'; writer: CommentWriter; asChoices: CommentWriter[] }
  | { kind: 'readonly'; reasonCode: string; reasonText: string };

/** action 返回形状的运行时收窄 */
function errorOf(data: unknown): string | null {
  if (data !== null && typeof data === 'object' && 'ok' in data && (data as { ok: unknown }).ok === false) {
    const error = (data as { error?: unknown }).error;
    return typeof error === 'string' ? error : '写入被拒绝';
  }
  return null;
}

export interface CommentsSidebarProps {
  pagePath: string;
  threads: PageThreadSummary[];
  access: CommentsAccess;
  /** 宿主的评论正文组件：按集合内路径渲染（fumadocs 的 client loader），正文按需加载 */
  BodyComponent: ComponentType<{ path: string }>;
  /** 激活的评论串（与正文外覆盖层联动）：命中时卡片高亮 */
  activeThreadId?: string | null;
  /** 点某串的标题时通知宿主（宿主可用它激活覆盖层锚点） */
  onThreadActivate?: (threadId: string | null) => void;
  /** 宿主接的展示插槽（当前身份标识这类宿主自己的东西） */
  headerSlot?: ReactNode;
}

export function CommentsSidebar({
  pagePath,
  threads,
  access,
  BodyComponent,
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
        <NewThreadForm pagePath={pagePath} asChoices={access.asChoices} />
      ) : (
        <p data-readonly-reason={access.reasonCode} className="docsite-readonly-reason">
          {access.reasonText}
        </p>
      )}
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          writable={access.kind === 'writable'}
          asChoices={access.kind === 'writable' ? access.asChoices : []}
          BodyComponent={BodyComponent}
          active={thread.id === activeThreadId}
          onActivate={onThreadActivate}
        />
      ))}
    </aside>
  );
}

function AuthorSelect({ asChoices }: { asChoices: CommentWriter[] }) {
  if (asChoices.length <= 1) return null;
  const [self, ...agents] = asChoices;
  return (
    <label className="docsite-author-select">
      署名
      {/* as 只用于 agent 声明署名；本人选项的 value 必须为空（action 把空 as 当省略），
          传本人的 id 会被按「as 目标必须是 agent」拒绝 */}
      <select name="as" defaultValue="">
        <option value="">{self.name}（本人）</option>
        {agents.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NewThreadForm({ pagePath, asChoices }: { pagePath: string; asChoices: CommentWriter[] }) {
  const fetcher = useFetcher();
  const error = errorOf(fetcher.data);
  return (
    <fetcher.Form method="post" data-new-thread-form className="docsite-new-thread">
      <input type="hidden" name="intent" value="create-thread" />
      <input type="hidden" name="page" value={pagePath} />
      <textarea name="body" required rows={3} placeholder="新建评论串（支持 MDX）" />
      <label className="docsite-anchor-input">
        锚点
        <input name="anchor" placeholder="页面元素的 id，可空" />
      </label>
      <div className="docsite-form-row">
        <AuthorSelect asChoices={asChoices} />
        <button type="submit" disabled={fetcher.state !== 'idle'}>
          {fetcher.state !== 'idle' ? '写入中…' : '新建评论串'}
        </button>
      </div>
      {error ? <p data-action-error>{error}</p> : null}
    </fetcher.Form>
  );
}

function ThreadCard({
  thread,
  writable,
  asChoices,
  BodyComponent,
  active,
  onActivate,
}: {
  thread: PageThreadSummary;
  writable: boolean;
  asChoices: CommentWriter[];
  BodyComponent: ComponentType<{ path: string }>;
  active: boolean;
  onActivate?: (threadId: string | null) => void;
}) {
  const fetcher = useFetcher();
  const error = errorOf(fetcher.data);
  return (
    <section
      data-comment-card={thread.id}
      data-thread-author={thread.author.name}
      data-thread-anchor={thread.anchor ?? ''}
      className={active ? 'docsite-comment-card docsite-comment-card-active' : 'docsite-comment-card'}
    >
      <header className="docsite-comment-meta">
        {thread.anchor ? (
          <button
            type="button"
            className="docsite-comment-anchor-link"
            data-anchor-link={thread.anchor}
            onClick={() => onActivate?.(active ? null : thread.id)}
          >
            ⚲
          </button>
        ) : null}
        <span>
          {thread.author.name} · {new Date(thread.createdAt).toLocaleString('zh-CN')}
        </span>
        {writable ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="delete-thread" />
            <input type="hidden" name="threadId" value={thread.id} />
            <button type="submit" data-delete-thread={thread.id}>
              删除整串
            </button>
          </fetcher.Form>
        ) : null}
      </header>
      <CommentBody BodyComponent={BodyComponent} path={thread.headPath} />
      {thread.replies.map((reply) => (
        <div key={reply.id} data-reply={reply.id} className="docsite-reply">
          <div className="docsite-comment-meta">
            <span data-reply-author={reply.id}>
              {reply.author.name} · {new Date(reply.createdAt).toLocaleString('zh-CN')}
            </span>
            {writable ? (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete-reply" />
                <input type="hidden" name="threadId" value={thread.id} />
                <input type="hidden" name="replyId" value={reply.id} />
                <button type="submit" data-delete-reply={reply.id}>
                  删除
                </button>
              </fetcher.Form>
            ) : null}
          </div>
          <CommentBody BodyComponent={BodyComponent} path={reply.path} />
        </div>
      ))}
      {writable ? (
        <fetcher.Form method="post" data-reply-form={thread.id} className="docsite-reply-form">
          <input type="hidden" name="intent" value="reply" />
          <input type="hidden" name="threadId" value={thread.id} />
          <textarea name="body" required rows={2} placeholder="回复（支持 MDX）" />
          <div className="docsite-form-row">
            <AuthorSelect asChoices={asChoices} />
            <button type="submit" disabled={fetcher.state !== 'idle'}>
              {fetcher.state !== 'idle' ? '写入中…' : '回复'}
            </button>
          </div>
        </fetcher.Form>
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
