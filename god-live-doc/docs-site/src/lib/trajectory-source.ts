import { loader } from 'fumadocs-core/source';
// .source/ 是 fumadocs-mdx 按 source.config.ts 生成的（gitignore），集合从这里拿
import { trajectory } from '../../.source/server';

export const trajectorySource = loader({
  baseUrl: '/trajectory',
  source: trajectory.toFumadocsSource(),
});
