import { replaceSource } from 'fumadocs-core/mdx-plugins/stringifier';
export function auditPlugin() {
  return (tree: any, file: any) => {
    const visit = (nodes: any[]) => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.children) visit(node.children);
        if (String(file.path).endsWith('audit-pin-lowcoupling.mdx') && ['PinBlock', 'PinTreeBlock'].includes(node.name)) {
          const title = node.attributes.find((x: any) => x.name === 'title')?.value;
          node.data = { ...node.data, structuredData: { contents: [{ content: title }] } };
          delete node.position;
        }
        if (node.type === 'text' && node.value.includes('TermWord')) {
          const text = node.value;
          const parts = text.split('TermWord');
          nodes.splice(i, 1, { type: 'text', value: parts[0] }, {
            type: 'mdxJsxTextElement', name: 'Term', attributes: [],
            children: [{ type: 'text', value: 'TermWord' }],
          }, { type: 'text', value: parts.slice(1).join('TermWord') });
          i += 2;
          continue;
        }
        if (node.name !== 'AuditPin') continue;
        const mode = node.attributes.find((x: any) => x.name === 'mode')?.value;
        const registered = `PIN_REGISTERED_${mode}`;
        replaceSource(file, node, registered);
        if (mode === 'same-node') { node.name = 'Outer'; continue; }
        const block = { type: 'mdxJsxFlowElement', name: 'Outer', attributes: [], children: [],
          ...(mode === 'no-position' ? {} : { position: node.position }) };
        if (mode === 'search-record') (block as any).data = { structuredData: { contents: [{ content: 'src/needle.ts : Heading only' }] } };
        if (mode === 'second-edit') replaceSource(file, block as any, 'SECOND_REGISTERED');
        nodes[i] = block;
      }
    };
    visit(tree.children);
  };
}
