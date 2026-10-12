import { Link } from 'react-router';

export function meta() {
  return [{ title: '原生评论探针' }];
}

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-4 text-2xl font-bold">Fumadocs 原生评论闭环探针</h1>
      <p className="mb-4 text-fd-muted-foreground">
        标准 Fumadocs + React Router 接线：Config API 集合、server/browser 入口分离、
        createClientLoader 按需正文；页面旁栏读写当前页评论。
      </p>
      <Link to="/docs" className="text-primary underline">
        打开文档页 →
      </Link>
    </main>
  );
}
