import type { AssemblyResult, ReportDocument, ReportInline } from '../core/types.ts';

/** Search and machine-readable text come from the same assembled data as the reader. */
export function reportMeta(input: ReportDocument | AssemblyResult) {
  const report = 'document' in input ? input : undefined;
  const document = report?.document ?? input as ReportDocument;
  const inline = (items: ReportInline[]): string => items.map(item => {
    switch (item.type) {
      case 'text': return item.text;
      case 'math': return `$${item.latex}$`;
      case 'link': return `[${item.text}](${item.href})`;
      case 'break': return '\n';
      case 'ref': {
        const target = report?.index[item.target];
        return target ? target[item.display] ?? target.label : item.externalLabel ?? item.target;
      }
      case 'note_ref': return `[脚注 ${report?.index[item.target]?.number ?? item.target}]`;
      case 'cite': return `[${item.targets.map(id => report?.index[id]?.number ?? id).join(', ')}]`;
      default: throw new Error(`不支持的行内节点：${(item as { type: string }).type}`);
    }
  }).join('');
  const block = (node: ReportDocument['blocks'][number], depth = 2): string => {
    switch (node.type) {
      case 'section': return `${'#'.repeat(Math.min(depth, 6))} ${report?.index[node.id]?.number ? report.index[node.id]!.number + ' ' : ''}${node.title}\n\n${node.children.map(child => block(child, depth + 1)).join('\n\n')}`;
      case 'abstract': return `## ${node.title ?? '摘要'}\n\n${node.paragraphs.map(p => block(p)).join('\n\n')}\n\n关键词：${node.keywords.join('；')}`;
      case 'paragraph': return inline(node.content);
      case 'equation': return `$$\n${node.latex}\n$$${report?.index[node.id]?.number ? `\n(${report.index[node.id]!.number})` : ''}`;
      case 'figure': {
        const images = node.panels
          ? node.panels.map(panel => `![${panel.alt}](${panel.src})\n${report?.index[panel.id]?.label ?? panel.id}${panel.caption ? ' ' + inline(panel.caption) : ''}`).join('\n\n')
          : `![${node.alt}](${node.src})`;
        return `${images}\n\n${report?.index[node.id]?.label ?? ''} ${inline(node.caption)}`;
      }
      case 'table': return `${node.caption ? `${report?.index[node.id]?.label ?? ''} ${inline(node.caption)}\n\n` : ''}${node.rows.map(row => row.cells.map(cell => cell.blocks.map(child => block(child, depth)).join('\n')).join(' | ')).join('\n')}`;
      case 'list': return node.items.map((item, i) => `${node.ordered ? `${(node.start ?? 1) + i}.` : '-'} ${item.blocks.map(child => block(child, depth)).join('\n')}`).join('\n');
      case 'code': return `\`\`\`${node.language}\n${node.text}\n\`\`\``;
      case 'bibliography': return `## 参考文献\n\n${(document.references ?? []).map(ref => `[${report?.index[ref.id]?.number ?? ref.id}] ${ref.text}${ref.url ? ' ' + ref.url : ''}`).join('\n\n')}`;
      case 'include': throw new Error(`reportMeta 需要已组装文档，未展开：${node.src}`);
      default: throw new Error(`不支持的正文节点：${(node as { type: string }).type}`);
    }
  };
  const text = document.blocks.map(node => block(node)).join('\n\n');
  const noteText = (document.notes ?? []).map(note => `脚注 ${report?.index[note.id]?.number ?? note.id}：${note.blocks.map(node => block(node)).join('\n\n')}`).join('\n\n');
  const referenceText = (document.references ?? []).map(ref => ref.text).join('\n');
  return {
    title: document.metadata.title,
    description: [document.metadata.authors?.join('、'), document.metadata.date].filter(Boolean).join(' · ') || undefined,
    searchText: [text, noteText, referenceText].filter(Boolean).join('\n\n'),
    markdown: `# ${document.metadata.title}\n\n${text}${noteText ? '\n\n' + noteText : ''}\n`,
  };
}
