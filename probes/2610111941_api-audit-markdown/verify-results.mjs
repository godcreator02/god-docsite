import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('.', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('out/baseline-report.json', root)));
const results = JSON.parse(readFileSync(new URL('out/audit-report.json', root)));
const byPath = Object.fromEntries(results.map(x => [x.path, x]));
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
check('31 original outputs match byte for byte', () => { assert.equal(baseline.count, 31); assert.equal(baseline.identical, 31); });
check('24 successful fixtures need no explicit jsxComponents wrapper', () => {
  assert.equal(results.filter(x => !x.error).length, 24);
  assert.ok(results.filter(x => !x.error).every(x => x.noWrapperIdentical === true));
});
check('line-start scanner misses author inline JSX and component-produced inline JSX', () => {
  for (const path of ['audit-inline.mdx', 'audit-produced-inline.mdx', 'audit-produced-raw.mdx', 'audit-html-container.mdx']) {
    assert.match(byPath[path].text, /<(?:Inner|MissingInline)\s/);
    assert.deepEqual(byPath[path].detected, []);
  }
});
check('line-start scanner falsely flags code fence examples', () => {
  assert.match(byPath['audit-fence.mdx'].text, /^```tsx\n<ExampleOnly \/>\n```$/);
  assert.deepEqual(byPath['audit-fence.mdx'].detected, ['ExampleOnly']);
});
check('scanner loses alias identity and misses lowercase implementation names', () => {
  assert.deepEqual(byPath['audit-alias.mdx'].detected, ['RenamedImplementation']);
  assert.equal(byPath['audit-lower-alias.mdx'].text, '<lowerImplementation />');
  assert.deepEqual(byPath['audit-lower-alias.mdx'].detected, []);
  assert.deepEqual(byPath['audit-member.mdx'].detected, ['UI']);
});
check('missing component and nested unresolved children remain JSX', () => {
  assert.equal(byPath['audit-missing.mdx'].text, '<Missing />');
  assert.deepEqual(byPath['audit-nested.mdx'].detected, ['Outer', 'Inner']);
  assert.deepEqual(byPath['audit-good-nested.mdx'].detected, ['Inner']);
});
check('pre-opt-in throw serializes JSX, post-opt-in throw propagates', () => {
  assert.equal(byPath['audit-throw-before.mdx'].text, '<ThrowBefore />');
  assert.match(byPath['audit-throw-after.mdx'].error, /after opt-in/);
});
check('Term no-position transformation retains source word in Markdown and search', () => {
  assert.equal(byPath['audit-term.mdx'].text, 'prefix TermWord suffix');
  assert.equal(byPath['audit-term.mdx'].structuredData.contents[0].content, 'prefix TermWord suffix');
});
check('same-node mutation loses prior registration; separate same-range objects retain first edit', () => {
  assert.match(byPath['audit-pin-same.mdx'].text, /^<Outer /);
  assert.equal(byPath['audit-pin-position.mdx'].text, 'PIN_REGISTERED_distinct-position');
  assert.equal(byPath['audit-pin-second.mdx'].text, 'PIN_REGISTERED_second-edit');
  assert.equal(byPath['audit-pin-no-position.mdx'].text, 'PIN_REGISTERED_no-position');
});
check('current E8 Pin and PinTree search still contain code/tree bodies', () => {
  assert.ok(byPath['e8.mdx'].structuredData.contents.some(x => x.content.includes("export const pinnedValue = 'v2'")));
  assert.match(byPath['audit-pin-tree.mdx'].structuredData.contents[0].content, /one\.ts/);
});
check('public structuredData plus generated nodes without positions keeps code output but narrows search', () => {
  const x = byPath['audit-pin-lowcoupling.mdx'];
  assert.match(x.text, /export const pinnedValue/);
  assert.match(x.text, /one\.ts/);
  assert.deepEqual(x.structuredData.contents.map(x => x.content), ['pinned/a.ts:1-1', 'pinned/dir/']);
});
check('real local PNG, MDX include, TS include and npm source forms are preserved/expanded', () => {
  const text = byPath['audit-assets.mdx'].text;
  assert.match(text, /^!\[Local real PNG\]\(\.\/audit-image\.png\)/);
  assert.match(text, /INCLUDED_REAL_CONTENT \*\*bold\*\*\./);
  assert.match(text, /included component text/);
  assert.match(text, /```ts\nexport const includedValue = 'INCLUDED_REAL_CODE';\n```/);
  assert.match(text, /```npm\nnpm i fumadocs-core\n```/);
  assert.match(text, /```package-install\nfumadocs-core\n```/);
});
const report = { passed: checks.length, checks };
writeFileSync(new URL('out/verification.json', root), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
