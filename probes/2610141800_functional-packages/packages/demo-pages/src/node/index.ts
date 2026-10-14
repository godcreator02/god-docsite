import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { demoCounterFileRelativePath, parseDemoCounterData, type DemoCounterData } from '../core/index.js';

export function demoCounterFilePath(siteDir: string): string {
  return path.join(siteDir, demoCounterFileRelativePath);
}

export async function readDemoCounterFile(siteDir: string): Promise<DemoCounterData> {
  const text = await readFile(demoCounterFilePath(siteDir), 'utf8');
  return parseDemoCounterData(JSON.parse(text));
}

export async function writeDemoCounterFile(siteDir: string, data: DemoCounterData): Promise<void> {
  await writeFile(demoCounterFilePath(siteDir), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
