import { ReportContentError } from './types.js';

/** Recursive JSON reader keeps duplicate-key evidence that JSON.parse discards. */
export function parseReportJson(text: string, file = ''): unknown {
  let i = 0;
  const fail = (message: string): never => { throw new ReportContentError(`${message} (offset ${i})`, file); };
  const space = () => { while (/[ \t\r\n]/.test(text[i] ?? '') && i < text.length) i++; };
  function string(): string {
    const start = i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i++] === '"') {
        try { return JSON.parse(text.slice(start, i)) as string; } catch { return fail('Invalid JSON string'); }
      }
    }
    return fail('Unterminated JSON string');
  }
  function value(): unknown {
    space();
    if (text[i] === '"') return string();
    if (text[i] === '{') {
      i++; space(); const object: Record<string, unknown> = Object.create(null);
      if (text[i] === '}') { i++; return object; }
      while (true) {
        space(); if (text[i] !== '"') fail('Expected object key');
        const key = string();
        if (Object.hasOwn(object, key)) fail(`Duplicate JSON key: ${key}`);
        space(); if (text[i++] !== ':') fail('Expected colon');
        object[key] = value(); space();
        const separator = text[i++]; if (separator === '}') return object;
        if (separator !== ',') fail('Expected comma or closing brace');
      }
    }
    if (text[i] === '[') {
      i++; space(); const array: unknown[] = [];
      if (text[i] === ']') { i++; return array; }
      while (true) {
        array.push(value()); space(); const separator = text[i++];
        if (separator === ']') return array;
        if (separator !== ',') fail('Expected comma or closing bracket');
      }
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
    if (!match) return fail('Invalid JSON value');
    i += match[0].length;
    const parsed: unknown = JSON.parse(match[0]);
    if (typeof parsed === 'number' && !Number.isFinite(parsed)) fail('Nonfinite JSON number');
    return parsed;
  }
  const result = value(); space(); if (i !== text.length) fail('Trailing JSON content'); return result;
}
