import { currentSources } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const parts = await Promise.all(Object.values(currentSources).map(({ llms }) => llms.index()));
  return new Response(parts.join('\n\n'));
}
