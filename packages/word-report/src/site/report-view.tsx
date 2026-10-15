import { Fragment, type ReactNode } from 'react';
import katex from 'katex';
import { assembleDocument } from '../core/assemble.ts';
import type { AssemblyResult, ReportDocument, ReportInline } from '../core/types.ts';

export type AssetUrl = (sourcePath: string, compiledPath: string) => string;
export interface ReportViewProps { report: AssemblyResult; assetUrl?: AssetUrl }

function RenderError({ children }: { children: ReactNode }) {
  return <div className="report-error" role="alert">{children}</div>;
}

function MathContent({ latex, block = false, id }: { latex: string; block?: boolean; id: string }) {
  try {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id)) throw new Error(`非法公式 ID：${id}`);
    const html = katex.renderToString(latex, { displayMode: block, throwOnError: true, trust: false, output: 'htmlAndMathml' });
    // 评论定位找最近的 .katex：公式的 id 要在 .katex 这一层上
    const anchored = html.replace('class="katex"', `class="katex" id="${id}" data-comment-target=""`);
    return <span className={block ? 'report-math-block' : 'report-math'} dangerouslySetInnerHTML={{ __html: anchored }} />;
  } catch (error) {
    return <span id={id} data-comment-target="" className="report-math-error" role="alert">公式预览失败：{error instanceof Error ? error.message : String(error)}<code>{latex}</code></span>;
  }
}

/** 报告里各块的 id 原样写到元素上：评论按元素 id 定位 */
export function ReportView({ report, assetUrl }: ReportViewProps) {
  const { document, index } = report;
  const hasBibliography = (blocks: ReportDocument['blocks']): boolean => blocks.some(node => node.type === 'bibliography' || (node.type === 'section' && hasBibliography(node.children)));
  const inlines = (items: ReportInline[]): ReactNode => items.map((item, i) => {
    switch (item.type) {
      case 'text': {
        let content: ReactNode = item.text;
        for (const mark of item.marks ?? []) {
          switch (mark) {
            case 'strong': content = <strong>{content}</strong>; break;
            case 'em': content = <em>{content}</em>; break;
            case 'sub': content = <sub>{content}</sub>; break;
            case 'sup': content = <sup>{content}</sup>; break;
            case 'code': content = <code>{content}</code>; break;
          }
        }
        return <Fragment key={i}>{content}</Fragment>;
      }
      case 'math': return <MathContent key={item.id} id={item.id} latex={item.latex} />;
      case 'break': return <br key={i} />;
      case 'link': return <a key={item.id} id={item.id} href={item.href} rel="noopener noreferrer">{item.text}</a>;
      case 'ref': {
        const target = index[item.target];
        return target
          ? <a key={item.id} id={item.id} href={`#${item.target}`} className="report-ref">{target[item.display] ?? target.label}</a>
          : <span key={item.id} id={item.id} className="report-external-ref">{item.externalLabel ?? `引用目标不存在：${item.target}`}（未收录于当前文档）</span>;
      }
      case 'note_ref': return <sup key={item.id} id={item.id}><a href={`#${item.target}`} aria-label={`脚注 ${index[item.target]?.number ?? item.target}`}>{index[item.target]?.number ?? '?'}</a></sup>;
      case 'cite': return <span key={item.id} id={item.id} className="report-cite">[{item.targets.map((target, n) => <Fragment key={target}>{n > 0 ? ', ' : ''}<a href={`#${target}`}>{index[target]?.number ?? '?'}</a></Fragment>)}]</span>;
      default: return <RenderError key={i}>不支持的行内节点：{(item as { type: string }).type}</RenderError>;
    }
  });
  const bibliography = () => <ol className="report-bibliography">{[...(document.references ?? [])].sort((a, b) => Number(index[a.id]?.number) - Number(index[b.id]?.number)).map(ref => <li id={ref.id} key={ref.id} value={Number(index[ref.id]?.number) || undefined}>{ref.text}{ref.url && <> <a href={ref.url} rel="noopener noreferrer">来源</a></>}</li>)}</ol>;
  const block = (node: ReportDocument['blocks'][number], depth = 2): ReactNode => {
    if (node.type === 'include') return <RenderError key={node.src}>文档尚未组装：{node.src}</RenderError>;
    const label = index[node.id];
    const origin = report.sources[node.id];
    const attrs = { id: node.id, 'data-report-source': origin?.file, 'data-report-pointer': origin?.pointer };
    switch (node.type) {
      case 'section': {
        const Heading = `h${Math.min(depth, 6)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        return <section key={node.id}><Heading {...attrs}>{label?.number ? `${label.number} ` : ''}{node.title}</Heading>{node.children.map(child => block(child, depth + 1))}</section>;
      }
      case 'abstract': return <section key={node.id} className="report-abstract"><h2 {...attrs}>{node.title ?? '摘要'}</h2>{node.paragraphs.map(p => block(p, depth))}<p className="report-keywords"><strong>关键词：</strong>{node.keywords.join('；')}</p></section>;
      case 'paragraph': return <p key={node.id} {...attrs}>{inlines(node.content)}</p>;
      case 'equation': return <div key={node.id} data-report-source={origin?.file} data-report-pointer={origin?.pointer} className="report-equation"><MathContent id={node.id} latex={node.latex} block />{node.numbered && <span className="report-equation-number">({label?.number ?? '?'})</span>}</div>;
      case 'figure': {
        const source = report.assets[node.src] ?? node.src;
        return <figure key={node.id} data-report-source={origin?.file} data-report-pointer={origin?.pointer}><img id={node.id} src={assetUrl?.(source, node.src) ?? source} alt={node.alt} loading="lazy" /><figcaption id={`${node.id}-caption`}>{label?.number && <span>{label.label} </span>}{inlines(node.caption)}</figcaption></figure>;
      }
      case 'code': return <pre key={node.id} {...attrs}><code className={`language-${node.language}`}>{node.text}</code></pre>;
      case 'list': {
        const List = node.ordered ? 'ol' : 'ul';
        return <List key={node.id} {...attrs} start={node.ordered ? node.start : undefined}>{node.items.map(item => <li id={item.id} key={item.id}>{item.blocks.map(child => block(child, depth))}</li>)}</List>;
      }
      case 'table': return <div key={node.id} className="report-table-wrap"><table {...attrs}>{node.caption && <caption>{node.numbered && <span>{label?.label} </span>}{inlines(node.caption)}</caption>}<colgroup>{node.columns.map(col => <col id={col.id} key={col.id} />)}</colgroup><tbody>{node.rows.map((row, rowIndex) => <tr id={row.id} key={row.id}>{row.cells.map(cell => {
        const Cell = rowIndex < node.headerRows ? 'th' : 'td';
        return <Cell id={cell.id} key={cell.id} scope={Cell === 'th' ? 'col' : undefined} rowSpan={cell.rowSpan} colSpan={cell.colSpan}>{cell.blocks.map(child => block(child, depth))}</Cell>;
      })}</tr>)}</tbody></table></div>;
      case 'bibliography': return <section key={node.id}><h2 {...attrs}>参考文献</h2>{bibliography()}</section>;
      default: return <RenderError key={(node as { id: string }).id}>不支持的正文节点：{(node as { type: string }).type}</RenderError>;
    }
  };
  return <div className="report-document" lang={document.metadata.language}>
    {document.metadata.fields?.length ? <dl className="report-fields">{document.metadata.fields.map(field => <Fragment key={field.id}><dt>{field.label}</dt><dd id={field.id}>{field.value}</dd></Fragment>)}</dl> : null}
    {report.warnings.length > 0 && <aside className="report-warnings" aria-label="文档提示"><p>当前文档有 {report.warnings.length} 条提示，请在交付前核对。</p><details><summary>查看提示详情</summary>{report.warnings.map((warning, i) => <p key={i}>{warning.message}<small>{warning.file}{warning.pointer}</small></p>)}</details></aside>}
    {document.blocks.map(node => block(node))}
    {(document.notes?.length ?? 0) > 0 && <section className="report-notes"><h2>脚注</h2><ol>{[...document.notes!].sort((a, b) => Number(index[a.id]?.number) - Number(index[b.id]?.number)).map(note => <li id={note.id} key={note.id} value={Number(index[note.id]?.number) || undefined}>{note.blocks.map(node => block(node))}</li>)}</ol></section>}
    {!hasBibliography(document.blocks) && (document.references?.length ?? 0) > 0 && <section><h2>参考文献</h2>{bibliography()}</section>}
  </div>;
}

export interface ReportPageProps {
  entry: string;
  files: Record<string, string | ReportDocument>;
  mode?: 'complete' | 'standalone';
  assetUrl?: AssetUrl;
}

export function ReportPage({ entry, files, mode = 'complete', assetUrl }: ReportPageProps) {
  let report: AssemblyResult;
  try { report = assembleDocument(entry, files, { mode }); }
  catch (error) { return <RenderError>报告无法显示：{error instanceof Error ? error.message : String(error)}</RenderError>; }
  return <ReportView report={report} assetUrl={assetUrl} />;
}
