import { readFileSync } from 'node:fs';
export function auditNodePlugin(options: { marker: string }) {
  // A real Node-only operation executed at compile time.
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
  return (tree: any) => {
    tree.children.push({ type: 'paragraph', children: [{ type: 'text', value: options.marker }] });
  };
}
