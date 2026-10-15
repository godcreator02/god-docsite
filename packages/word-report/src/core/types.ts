export type ReportInline =
  | { type: 'text'; text: string; marks?: ('strong' | 'em' | 'sub' | 'sup' | 'code')[] }
  | { type: 'math'; id: string; latex: string }
  | { type: 'ref'; id: string; target: string; display: 'label' | 'number' | 'title'; externalLabel?: string }
  | { type: 'link'; id: string; text: string; href: string }
  | { type: 'note_ref'; id: string; target: string }
  | { type: 'cite'; id: string; targets: string[] }
  | { type: 'break' };
export interface Paragraph { type: 'paragraph'; id: string; content: ReportInline[] }
export interface Section { type: 'section'; id: string; title: string; numbering: 'decimal' | 'appendix' | 'none'; children: ReportBlock[] }
export interface ReportList { type: 'list'; id: string; ordered: boolean; start?: number; items: { id: string; blocks: (Paragraph | ReportList)[] }[] }
export interface Figure { type: 'figure'; id: string; src: string; caption: ReportInline[]; alt: string }
export interface Equation { type: 'equation'; id: string; latex: string; numbered: boolean }
export interface TableCell { id: string; rowSpan?: number; colSpan?: number; blocks: CellBlock[] }
export interface Table { type: 'table'; id: string; numbered: boolean; caption?: ReportInline[]; columns: { id: string }[]; headerRows: number; rows: { id: string; cells: TableCell[] }[] }
export interface Code { type: 'code'; id: string; language: string; text: string }
export type CellBlock = Paragraph | ReportList | Figure | Table | Equation | Code;
export interface Bibliography { type: 'bibliography'; id: string }
export interface Abstract { type: 'abstract'; id: string; title?: string; paragraphs: Paragraph[]; keywords: string[] }
export interface Include { type: 'include'; src: string }
export type ReportBlock = Section | CellBlock | Bibliography;
export interface ReportDocument {
  $schema?: string;
  format: 'docreport'; schemaVersion: 1; id: string;
  metadata: {
    title: string; shortTitle?: string; language: string; authors?: string[]; date?: string; revision?: string;
    fields?: { id: string; label: string; value: string }[];
  };
  blocks: (ReportBlock | Abstract | Include)[];
  notes?: { id: string; blocks: (Paragraph | ReportList | Code)[] }[];
  references?: { id: string; text: string; url?: string }[];
}
export interface SourceLocation { file: string; pointer: string }
export interface IndexEntry { type: string; label: string; title: string; number?: string }
export type ReportIndex = Record<string, IndexEntry>;
export interface ContentWarning extends SourceLocation { message: string; id?: string }
export interface AssemblyResult {
  document: ReportDocument;
  index: Record<string, IndexEntry>;
  sources: Record<string, SourceLocation>;
  assets: Record<string, string>;
  dependencies: string[];
  warnings: ContentWarning[];
}
export interface AssemblyOptions { mode?: 'complete' | 'standalone' }
export type CompiledReport = AssemblyResult;
export class ReportContentError extends Error {
  readonly file: string;
  readonly pointer: string;
  constructor(message: string, file = '', pointer = '') {
    super(`${file}${pointer ? ':' + pointer : ''}${file || pointer ? ': ' : ''}${message}`);
    this.name = 'ReportContentError';
    this.file = file;
    this.pointer = pointer;
  }
}
