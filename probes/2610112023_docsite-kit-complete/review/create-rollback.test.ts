import { test, expect, vi } from '../../../packages/docsite-kit/node_modules/vitest/dist/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSite } from '../../../packages/create-docsite/src/create.ts';

test('partially written file is also removed on IO failure', () => {
  const review = fileURLToPath(new URL('.', import.meta.url));
  const tmp = fs.mkdtempSync(path.join(review, 'rollback-owned-'));
  const template = path.join(tmp, 'template');
  const target = path.join(tmp, 'site');
  fs.mkdirSync(template); fs.mkdirSync(target);
  fs.writeFileSync(path.join(template, 'file.txt'), 'complete content');
  const realWrite = fs.writeFileSync;
  try {
    vi.spyOn(fs, 'writeFileSync').mockImplementation((file, data, options) => {
      realWrite(file, 'partial', options);
      throw Object.assign(new Error('simulated disk full after partial write'), { code: 'ENOSPC' });
    });
    expect(() => createSite({dir:target, templateDir:template})).toThrow('disk full');
    expect(fs.readdirSync(target)).toEqual([]);
  } finally {
    vi.restoreAllMocks();
    const resolved = fs.realpathSync(tmp);
    if (!resolved.startsWith(fs.realpathSync(review) + path.sep)) throw new Error('cleanup outside review');
    fs.rmSync(resolved, {recursive:true,force:true});
  }
});

test('nested-only template also rolls back a newly created site root', () => {
  const review = fileURLToPath(new URL('.', import.meta.url));
  const tmp = fs.mkdtempSync(path.join(review, 'rollback-owned-'));
  const template = path.join(tmp, 'template');
  const target = path.join(tmp, 'site');
  fs.mkdirSync(path.join(template, 'nested'), {recursive:true});
  fs.writeFileSync(path.join(template, 'nested', 'file.txt'), 'content');
  try {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error('disk full'), {code:'ENOSPC'}); });
    expect(() => createSite({dir:target,templateDir:template})).toThrow('disk full');
    expect(fs.existsSync(target)).toBe(false);
  } finally {
    vi.restoreAllMocks();
    const resolved = fs.realpathSync(tmp);
    if (!resolved.startsWith(fs.realpathSync(review) + path.sep)) throw new Error('cleanup outside review');
    fs.rmSync(resolved, {recursive:true,force:true});
  }
});
