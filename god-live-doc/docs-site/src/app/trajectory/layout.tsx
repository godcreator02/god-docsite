import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { trajectorySource } from '@/lib/trajectory-source';
import type { ReactNode } from 'react';

// 卡页路由用卡集合自己的页树，跟主文档树（/docs）分开
export default function Layout({ children }: { children: ReactNode }) {
  return <DocsLayout tree={trajectorySource.getPageTree()}>{children}</DocsLayout>;
}
