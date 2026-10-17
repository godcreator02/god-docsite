// 用法：node gen-pages.mjs <站目录> <页数>
// 往 <站目录>/content/docs/bench/ 写入确定性生成的 mdx 页，每 50 页一个分组文件夹；页数 0 表示只删掉生成的页，留模板自带的两页。
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PAGES_PER_GROUP = 50;

export function generatedPageSlugs(pageCount) {
  const slugs = [];
  for (let index = 1; index <= pageCount; index++) slugs.push(`bench/${groupName(index)}/${pageName(index)}`);
  return slugs;
}

function groupName(index) {
  return `group-${String(Math.ceil(index / PAGES_PER_GROUP)).padStart(2, '0')}`;
}

function pageName(index) {
  return `page-${String(index).padStart(3, '0')}`;
}

export function pageMarker(index) {
  return `bench-marker-${index}`;
}

function renderPage(index, pageCount) {
  const next = (index % pageCount) + 1;
  return `---
title: Page ${index}
description: Synthetic page ${index} for comparing fumadocs dev servers.
---

This page exists to load the dev server with realistic markdown. Marker: ${pageMarker(index)}.

## Overview

Module ${index} reads its options, validates them, and hands the result to the scheduler.
Each option has a default, so callers only pass what they want to change.
The scheduler keeps a queue per priority and drains the highest priority first.

<Callout type="info">
  Options are validated once at the boundary; internal calls trust the parsed value.
</Callout>

## Configuration

\`\`\`ts title="module-${index}.ts"
export interface Module${index}Options {
  name: string;
  retries: number;
  timeoutMs: number;
  tags: readonly string[];
}

export function createModule${index}(options: Partial<Module${index}Options> = {}) {
  const resolved: Module${index}Options = {
    name: options.name ?? 'module-${index}',
    retries: options.retries ?? 3,
    timeoutMs: options.timeoutMs ?? 5_000,
    tags: options.tags ?? [],
  };
  return {
    options: resolved,
    async run(task: () => Promise<void>) {
      for (let attempt = 0; attempt <= resolved.retries; attempt++) {
        try {
          return await task();
        } catch (error) {
          if (attempt === resolved.retries) throw error;
        }
      }
    },
  };
}
\`\`\`

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| \`name\` | \`string\` | \`module-${index}\` | Shown in logs |
| \`retries\` | \`number\` | \`3\` | Attempts after the first failure |
| \`timeoutMs\` | \`number\` | \`5000\` | Per attempt |
| \`tags\` | \`string[]\` | \`[]\` | Free-form labels |

## Usage

1. Install the package.
2. Create the module with the options you need.
3. Call \`run\` with an async task.

\`\`\`bash
pnpm add example-module-${index}
\`\`\`

\`\`\`tsx
import { createModule${index} } from 'example-module-${index}';

export function Button() {
  const module = createModule${index}({ retries: 1 });
  return <button onClick={() => module.run(async () => {})}>Run ${index}</button>;
}
\`\`\`

## Details

### Retry behaviour

A failed attempt is retried until \`retries\` is used up; the last error is thrown unchanged.

### Related pages

<Cards>
  <Card title="Page ${next}" href="/docs/bench/${groupName(next)}/${pageName(next)}" />
  <Card title="Test page" href="/docs/test" />
</Cards>
`;
}

export function writeGeneratedPages(siteDir, pageCount) {
  const benchDir = join(siteDir, 'content', 'docs', 'bench');
  if (existsSync(benchDir)) rmSync(benchDir, { recursive: true });
  for (let index = 1; index <= pageCount; index++) {
    const groupDir = join(benchDir, groupName(index));
    mkdirSync(groupDir, { recursive: true });
    writeFileSync(join(groupDir, `${pageName(index)}.mdx`), renderPage(index, pageCount));
  }
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) {
  const [siteDirArg, pageCountArg] = process.argv.slice(2);
  const pageCount = Number(pageCountArg);
  if (siteDirArg === undefined || !Number.isInteger(pageCount) || pageCount < 0) {
    console.error('用法：node gen-pages.mjs <站目录> <页数（非负整数）>');
    process.exit(2);
  }
  writeGeneratedPages(resolve(siteDirArg), pageCount);
  console.log(`已在 ${siteDirArg} 生成 ${pageCount} 页`);
}
