import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { trajectorySource } from '@/lib/trajectory-source';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <DocsLayout tree={trajectorySource.getPageTree()}>{children}</DocsLayout>;
}
