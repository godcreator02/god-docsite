# [Windows] import.meta.glob with a relative base does not update when files are added

## Describe the bug

On native Windows, Vite 8.3.4 does not invalidate an `import.meta.glob` importer when a newly added file matches a glob using a relative `base`.

Existing files are included on startup. The file watcher receives the new file's `add` event, but the glob importer is not included in the modules returned by the import-glob HMR hook. The browser's list stays stale. Restarting the dev server discovers the file.

This reproduces in plain Vite with text files: no React, React Router, Fumadocs, SSR, or custom content compiler is required.

## Reproduction

A small standalone reproduction accompanies this draft in `repro/`. It uses only `vite: 8.3.4`. It must be run on native Windows to exercise the drive-letter path handling.

A public reproduction URL still needs to be supplied before submitting the GitHub bug-report form.

Files:

```text
package.json
index.html
src/main.js
content/initial.txt
```

`package.json`:

```json
{
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite --host 127.0.0.1" },
  "devDependencies": { "vite": "8.3.4" }
}
```

`index.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Vite relative glob base reproduction</title>
<pre id="files"></pre>
<script type="module" src="/src/main.js"></script>
```

`src/main.js`:

```js
const files = import.meta.glob('./**/*.txt', {
  base: '../content',
  query: '?raw',
  import: 'default',
  eager: true,
});

document.querySelector('#files').textContent =
  Object.keys(files).sort().join('\n');
```

`content/initial.txt` can contain any text.

## Steps to reproduce

1. On native Windows, place the reproduction in an ordinary local directory, e.g. `D:\\repro`.
2. Run `pnpm install`, then `pnpm dev`.
3. Open the URL printed by Vite. Confirm the list contains `./initial.txt`.
4. While the server is running, create `content/added.txt` from a second terminal:
   ```powershell
   Set-Content -LiteralPath content/added.txt -Value added
   ```
5. Observe that the browser list does not update. We observed this for at least 10 seconds in a plain-Vite browser reproduction; the corresponding framework reproduction remained stale for over 30 seconds.
6. Restart the dev server: the new file is now included.

For independent controls, restart from the initial fixture with only one variant active:

| Glob form | Initial file found | Watcher receives add | Glob importer updated after add |
| --- | --- | --- | --- |
| `'./**/*.txt'`, `base: '../content'` | Yes | Yes | **No** |
| `'./**/*.txt'`, `base: '/content'` | Yes | Yes | Yes |
| `'../content/**/*.txt'`, without `base` | Yes | Yes | Yes |

Keep `query`, `import`, and `eager` unchanged for all variants. The no-base variant's result keys are relative to the importer, as expected.

## Expected behavior

Adding a matching file should invalidate the module containing `import.meta.glob`, so its transformed entries and the browser list update, as they do in the two control variants.

## Actual behavior and diagnostics

Read-only diagnostic plugins recorded the watcher events and `hotUpdate` arguments without returning replacement modules or manually invalidating/reloading anything:

- All variants receive the watcher `add` event and a `hotUpdate` event with `type: 'create'`.
- For the relative-base variant, the post-hook module list does not include `src/main.js`; a subsequent transform request still returns entries without the newly added file.
- For the root-relative-base and no-base variants, `src/main.js` is included and the transformed entries contain the new file.

There is no visible error for the failing variant.

## Source-level cause

In [`toAbsoluteGlob` in Vite 8.3.4](https://github.com/vitejs/vite/blob/v8.3.4/packages/vite/src/node/plugins/importMetaGlob.ts), the relative-base branch uses:

```ts
dir = posix.resolve(
  importer ? globSafePath(dirname(importer)) : root,
  base,
)
```

On Windows, normalized importer directories look like `D:/repro/src`, but `path.posix.isAbsolute('D:/repro/src')` is `false`. Consequently, `posix.resolve` prepends the current working directory instead of treating the drive-letter path as absolute.

The resulting glob has an extra working-directory prefix before the literal `D:/...`, rather than the intended `D:/repro/content/**/*.txt`.

The same source file builds the HMR picomatch functions from `globsResolved`. When a new file arrives as a normalized `D:/repro/content/added.txt` path, it cannot match that malformed glob. The importer's module is therefore not selected for invalidation.

We separately evaluated this path expression on Windows and confirmed that picomatch returns `false` for the malformed glob and `true` for the correctly resolved drive-letter glob.

## System Info

```text
OS: Native Windows, version 10.0.26200, x64 (not WSL)
Node.js: 24.14.1
Package manager: pnpm 12.4.2
Vite: 8.3.4
tinyglobby: 0.2.17
```

## Related reports and scope

- [#10616](https://github.com/vitejs/vite/issues/10616) has a similar symptom but was fixed by #14117 for globs inside packages. This reproduction imports an application-local module and does not depend on that scenario.
- [#2734](https://github.com/vitejs/vite/issues/2734) was an older SSR invalidation issue. This reproduction does not use SSR.
- This report concerns native Windows, relative glob `base`, and file addition. It does not claim equivalent results for production builds, UNC paths, virtual modules, or other platforms.

No upstream PR has been submitted for this report.

