import { Link } from 'react-router';
import type { CommentThread } from '@godcreator/docsite-comments';
import { AllComments } from '@godcreator/docsite-comments/react';
import type { Person, SiteIdentity } from '@godcreator/docsite-identity';
import { renderCommentBody } from '../lib/comment-body';
import type { CompiledCommentEntry } from '../lib/comment-entry';
import { allCommentsData } from '../lib/comment-data.server';

// loader 每次请求重新读盘：全部评论、「和我有关」（同一次读取的原文算 @）、页面标题
export async function loader() {
  return await allCommentsData();
}

export default function AllCommentsPage({
  loaderData,
}: {
  loaderData: {
    identity: SiteIdentity;
    people: Person[];
    aboutMe: string[];
    pageTitles: Record<string, string>;
    threads: CommentThread<CompiledCommentEntry>[];
  };
}) {
  const { identity, people, aboutMe, pageTitles, threads } = loaderData;
  return (
    <main>
      <h1>全部评论</h1>
      <nav className="site-nav">
        <Link to="/">首页</Link>
        <Link to="/second">第二页</Link>
        <Link to="/comments-demo">评论示例</Link>
        <Link to="/comments">全部评论</Link>
      </nav>
      <AllComments
        threads={threads}
        people={people}
        commenter={identity.person}
        aboutMe={aboutMe}
        pageTitles={pageTitles}
        renderBody={renderCommentBody}
        onWritten={() => window.location.reload()}
      />
    </main>
  );
}
