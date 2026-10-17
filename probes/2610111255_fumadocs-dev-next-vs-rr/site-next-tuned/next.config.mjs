import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// 由 bench/bench.mjs 经 BENCH_NEXT_TUNING（逗号分隔）选择要打开的优化项，同一个站测多种组合
const knownTunings = ['evict', 'threads', 'webpack-memory'];
const tunings = new Set((process.env.BENCH_NEXT_TUNING ?? '').split(',').filter(Boolean));
for (const tuning of tunings) {
  if (!knownTunings.includes(tuning)) throw new Error(`BENCH_NEXT_TUNING 里有不认识的项「${tuning}」，可选：${knownTunings.join('、')}`);
}

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  experimental: {
    ...(tunings.has('evict') && { turbopackMemoryEviction: 'full', turbopackGc: true }),
    ...(tunings.has('threads') && { turbopackPluginRuntimeStrategy: 'forceWorkerThreads' }),
    ...(tunings.has('webpack-memory') && { webpackMemoryOptimizations: true }),
  },
};

export default withMDX(config);
