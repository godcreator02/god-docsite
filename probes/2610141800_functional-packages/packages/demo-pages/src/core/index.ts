export interface DemoCounterData {
  count: number;
  updatedAt: string | null;
}

export interface DemoCounterEvent {
  count: number;
  updatedAt: string;
}

export const demoCounterFileRelativePath = 'data/demo-counter.json';

export function parseDemoCounterData(raw: unknown): DemoCounterData {
  if (typeof raw !== 'object' || raw === null) throw new Error('demo-counter.json 不是对象');
  const { count, updatedAt } = raw as Record<string, unknown>;
  if (typeof count !== 'number' || !Number.isInteger(count)) throw new Error('demo-counter.json 的 count 不是整数');
  if (updatedAt !== null && typeof updatedAt !== 'string') throw new Error('demo-counter.json 的 updatedAt 不是字符串或 null');
  return { count, updatedAt };
}

export function incrementDemoCounter(data: DemoCounterData, now: Date): DemoCounterData {
  return { count: data.count + 1, updatedAt: now.toISOString() };
}
