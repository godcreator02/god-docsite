import { NextRequest, NextResponse } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { currentZones, zoneContentRoute, zoneRoute } from '@/lib/shared';

// 现状区每个分区：网址后加 .md、或请求偏好 markdown 时，改写到这一页的机读版
const rewrites = currentZones.map(({ id }) => ({
  page: rewritePath(`${zoneRoute(id)}{/*path}`, `${zoneContentRoute(id)}{/*path}/content.md`).rewrite,
  suffix: rewritePath(`${zoneRoute(id)}{/*path}.md`, `${zoneContentRoute(id)}{/*path}/content.md`).rewrite,
}));

export default function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  for (const { suffix } of rewrites) {
    const result = suffix(path);
    if (result) return NextResponse.rewrite(new URL(result, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    for (const { page } of rewrites) {
      const result = page(path);
      if (result) {
        return NextResponse.rewrite(new URL(result, request.nextUrl), {
          // this URL has two representations, selected by `Accept`
          headers: { Vary: 'Accept' },
        });
      }
    }
  }

  return NextResponse.next();
}
