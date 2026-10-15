import { realpath, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { readReport } from './read-report.ts';
import { reportsDirName } from './report-files.ts';
import { parseReportJson } from '../core/json.ts';
import { validateDocument } from '../core/validate.ts';
import { ReportContentError, type ContentWarning } from '../core/types.ts';
export interface ReportCheckDiagnostic { file: string; pointer: string; message: string; entry: string; mode: 'standalone' | 'complete' }
export interface ReportCheckResult {
  checked: number;
  runs: { file: string; mode: 'standalone' | 'complete'; passed: boolean }[];
  problems: ReportCheckDiagnostic[];
  warnings: (ContentWarning & { entry: string; mode: 'standalone' | 'complete' })[];
}

/** 检查站点 reports/ 下的每个 content.json（每份报告与每一章）：只用本包的代码，不执行站点里的脚本 */
export async function checkReports(siteDir: string): Promise<ReportCheckResult> {
  const result: ReportCheckResult = { checked: 0, runs: [], problems: [], warnings: [] };
  let root: string;
  try { root = await realpath(path.resolve(siteDir)); }
  catch { throw new ReportContentError('没有这个站点目录', siteDir); }
  const relative = (file: string) => path.relative(root, file).split(path.sep).join('/');
  const entries: string[] = [], directories = new Set<string>();
  function diagnostic(error: unknown, file: string, mode: 'standalone' | 'complete') {
    const known = error instanceof ReportContentError;
    result.problems.push({ file: known && error.file ? error.file : file, pointer: known ? error.pointer : '', message: error instanceof Error ? error.message : String(error), entry: file, mode });
  }
  async function scan(directory: string): Promise<void> {
    const real = await realpath(directory), inside = path.relative(root, real);
    if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) throw new ReportContentError('Report directory escapes site content root', relative(directory));
    if (directories.has(real)) throw new ReportContentError('Circular or repeated report directory', relative(directory));
    directories.add(real);
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      let isDirectory = item.isDirectory();
      if (item.isSymbolicLink()) isDirectory = (await stat(file)).isDirectory();
      if (isDirectory) await scan(file);
      else if (item.name === 'content.json') entries.push(file);
    }
  }
  const reports = path.join(root, reportsDirName);
  try { await stat(reports); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return result; throw error; }
  await scan(reports);
  entries.sort();
  for (const entry of entries) {
    const file = relative(entry); result.checked++;
    let composite: boolean;
    try { const input = parseReportJson(await readFile(entry, 'utf8'), file); validateDocument(input, file); composite = input.blocks.some(x => x.type === 'include'); }
    catch (error) { diagnostic(error, file, 'standalone'); result.runs.push({ file, mode: 'standalone', passed: false }); continue; }
    const modes: ('standalone' | 'complete')[] = composite ? ['standalone', 'complete'] : ['standalone'];
    for (const mode of modes) {
      try {
        const report = await readReport(entry, { root, mode });
        result.warnings.push(...report.warnings.map(warning => ({ ...warning, entry: file, mode })));
        result.runs.push({ file, mode, passed: true });
      } catch (error) { diagnostic(error, file, mode); result.runs.push({ file, mode, passed: false }); }
    }
  }
  return result;
}
