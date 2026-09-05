import { loader } from 'fumadocs-core/source';
import { trajectory } from '../../.source/server';

export const trajectorySource = loader({
  baseUrl: '/trajectory',
  source: trajectory.toFumadocsSource(),
});
