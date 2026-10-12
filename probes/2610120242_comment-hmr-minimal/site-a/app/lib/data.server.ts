import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 实验A的服务端数据模块：不进客户端 bundle。
 * 实验A1对它做内容更新（加注释行），单独触发「SSR 模块图失效 → 客户端 route 模块 reload」这条链。
 */
const dataDir = fileURLToPath(new URL('../../data', import.meta.url));
const itemsFile = path.join(dataDir, 'items.json');

export type Item = { id: string; text: string };

export async function listItems(): Promise<Item[]> {
  try {
    return JSON.parse(await readFile(itemsFile, 'utf8')) as Item[];
  } catch {
    return [];
  }
}

export async function addItem(text: string): Promise<Item> {
  const items = await listItems();
  const item = { id: `item-${Date.now().toString(36)}`, text };
  items.push(item);
  await mkdir(dataDir, { recursive: true });
  await writeFile(itemsFile, `${JSON.stringify(items, null, 2)}\n`);
  return item;
}

export async function removeItem(id: string): Promise<void> {
  const items = (await listItems()).filter((item) => item.id !== id);
  await writeFile(itemsFile, `${JSON.stringify(items, null, 2)}\n`);
}
// touch-a1 0958
// touch-a1 1004
