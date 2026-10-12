import { Link } from 'react-router';
import type { CommentThread } from '@godcreator/docsite-comments';
import { PageComments, commentScopeProps } from '@godcreator/docsite-comments/react';
import type { SiteIdentity } from '@godcreator/docsite-identity';
import { IdentityBadge } from '@godcreator/docsite-identity/react';
import browserCollections from '../../.source/browser';
import { renderCommentBody } from '../lib/comment-body';
import type { CompiledCommentEntry } from '../lib/comment-entry';
import { commentsPageData } from '../lib/comment-data.server';

// 评论示例页的正文：走官方生成的 .source/browser 入口，与 A/B 集合同一机制
const demoClient = browserCollections.collectionDemo.createClientLoader({
  component({ default: Mdx }) {
    return <Mdx />;
  },
});

// loader 每次请求都重新读盘并编译评论（app/lib/comment-data.server.ts），不依赖任何集合失效机制
export async function loader() {
  return await commentsPageData('/comments-demo');
}

export default function CommentsDemo({
  loaderData,
}: {
  loaderData: {
    identity: SiteIdentity;
    people: import('@godcreator/docsite-identity').Person[];
    threads: CommentThread<CompiledCommentEntry>[];
    snapshots: Record<string, string>;
  };
}) {
  const { identity, people, threads, snapshots } = loaderData;
  return (
    <main>
      <h1>评论示例页</h1>
      <nav className="site-nav">
        <Link to="/">首页</Link>
        <Link to="/second">第二页</Link>
        <Link to="/comments-demo">评论示例</Link>
        <Link to="/comments">全部评论</Link>
        <span aria-label="当前身份">
          <IdentityBadge identity={identity} />
        </span>
      </nav>
      <p>这一页验证选中文字批注、折叠内容定位、元素批注与右侧栏。写评论要带身份启动（见本实验 README）。</p>
      <PageComments
        page="/comments-demo"
        threads={threads}
        snapshots={snapshots}
        commenter={identity.person}
        people={people}
        renderBody={renderCommentBody}
        onWritten={() => window.location.reload()}
      >
        <div {...commentScopeProps} className="demo-doc">
          {demoClient.useContent('index.mdx')}
        </div>
      </PageComments>
    </main>
  );
}
