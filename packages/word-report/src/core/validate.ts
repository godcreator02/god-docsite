import { reportSchema } from './schema.js';
import { ReportContentError, type ReportDocument } from './types.js';
type Schema = { [key: string]: any };
const schema = reportSchema as Schema;
const pointerKey = (key: string) => key.replace(/~/g, '~0').replace(/\//g, '~1');
export function stableValue(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableValue).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableValue((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
function shape(value: any, rule: Schema, pointer: string, file: string): void {
  const fail = (message: string): never => { throw new ReportContentError(message, file, pointer); };
  if (rule.$ref) { shape(value, schema.$defs[rule.$ref.split('/').at(-1)], pointer, file); return; }
  if (rule.oneOf) {
    const candidates = rule.oneOf.filter((r: Schema) => {
      const resolved = r.$ref ? schema.$defs[r.$ref.split('/').at(-1)] : r;
      return !resolved.properties?.type?.const || resolved.properties.type.const === value?.type;
    });
    if (candidates.length === 1) { shape(value, candidates[0], pointer, file); return; }
    let matches = 0;
    for (const candidate of candidates) { try { shape(value, candidate, pointer, file); matches++; } catch {} }
    if (matches !== 1) fail(`Unsupported or invalid node ${value?.type ?? ''}`);
  }
  if ('const' in rule && value !== rule.const) fail(`Expected ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.includes(value)) fail(`Expected one of ${rule.enum.join(', ')}`);
  if (rule.type) {
    const valid = rule.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : rule.type === 'array' ? Array.isArray(value)
      : rule.type === 'integer' ? Number.isSafeInteger(value)
      : typeof value === rule.type;
    if (!valid) fail(`Expected ${rule.type}`);
  }
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) fail('String must not be empty');
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail('String does not match protocol pattern');
    if (rule.format === 'date' && (Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) fail('Invalid calendar date');
  }
  if (typeof value === 'number' && rule.minimum !== undefined && value < rule.minimum) fail(`Minimum is ${rule.minimum}`);
  if (typeof value === 'number' && rule.maximum !== undefined && value > rule.maximum) fail(`Maximum is ${rule.maximum}`);
  if (Array.isArray(value)) {
    if (rule.minItems && value.length < rule.minItems) fail(rule.minItems === 1 ? 'Array must not be empty' : `At least ${rule.minItems} items`);
    if (rule.maxItems && value.length > rule.maxItems) fail(`At most ${rule.maxItems} items`);
    if (rule.uniqueItems && new Set(value.map(stableValue)).size !== value.length) fail('Duplicate array values');
    if (rule.items) value.forEach((v, i) => shape(v, rule.items, `${pointer}/${i}`, file));
    if (rule.contains && !value.some(v => { try { shape(v, rule.contains, pointer, file); return true; } catch { return false; } })) fail('Missing required array member');
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) fail(`Missing ${key}`);
    if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(rule.properties, key)) fail(`Unknown field: ${key}`);
    for (const [key, child] of Object.entries(rule.properties ?? {})) if (Object.hasOwn(value, key)) shape(value[key], child as Schema, `${pointer}/${pointerKey(key)}`, file);
  }
  for (const child of rule.allOf ?? []) shape(value, child, pointer, file);
  if (rule.not) { let matched = false; try { shape(value, rule.not, pointer, file); matched = true; } catch {} if (matched) fail('Disallowed field combination'); }
  if (rule.if) { let matched = false; try { shape(value, rule.if, pointer, file); matched = true; } catch {} if (matched && rule.then) shape(value, rule.then, pointer, file); }
}
export function validateDocument(value: unknown, file = ''): asserts value is ReportDocument {
  shape(value, schema, '', file);
}
export function* walk(value: unknown, pointer = ''): Generator<{ node: Record<string, any>; pointer: string }> {
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) yield* walk(value[i], `${pointer}/${i}`); }
  else if (value && typeof value === 'object') {
    yield { node: value as Record<string, any>, pointer };
    for (const [key, child] of Object.entries(value)) yield* walk(child, `${pointer}/${pointerKey(key)}`);
  }
}
export function safeRelativePath(raw: string, asset = false): string {
  const parts = raw.split('/');
  if (!raw || raw.includes('\\') || /[<>:"|?*%#\x00-\x1f]/.test(raw) || parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]|CONIN\$|CONOUT\$)(?:\.|$)/i.test(p))) throw new ReportContentError(`Invalid relative path: ${raw}`);
  if (asset && (parts[0] !== 'assets' || !/\.(png|jpg|jpeg)$/.test(raw))) throw new ReportContentError(`Unsupported asset path: ${raw}`);
  return raw;
}
export function validateTable(table: Record<string, any>, file: string, pointer: string): void {
  const fail = (message: string): never => { throw new ReportContentError(`${table.id}: ${message}`, file, pointer); };
  const rows = table.rows.length, cols = table.columns.length;
  if (cols > 63) fail('Word supports at most 63 columns');
  if (table.headerRows >= rows) fail('headerRows must leave a body row');
  const grid = Array.from({ length: rows }, () => Array(cols).fill(false));
  table.rows.forEach((row: any, r: number) => {
    for (const cell of row.cells) {
      const c = grid[r]!.indexOf(false), rs = cell.rowSpan ?? 1, cs = cell.colSpan ?? 1;
      if (c < 0 || r + rs > rows || c + cs > cols) fail(`${cell.id}: span out of bounds or extra cell`);
      if (r < table.headerRows && r + rs > table.headerRows) fail(`${cell.id}: span crosses header boundary`);
      for (let rr = r; rr < r + rs; rr++) for (let cc = c; cc < c + cs; cc++) { if (grid[rr]![cc]) fail(`${cell.id}: overlapping spans`); grid[rr]![cc] = true; }
    }
  });
  if (grid.some(row => row.some(v => !v))) fail('Table has uncovered grid slots');
}
