import type { Route } from './+types/index';
import { demo } from '@/lib/source';

export async function loader() {
  return { entries: demo.entries.map((e: { info: { path: string } }) => e.info.path) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="p-8">
      <h1 className="text-xl font-bold">meta collection repro</h1>
      <p>meta collection entries: {JSON.stringify(loaderData.entries)}</p>
    </main>
  );
}
