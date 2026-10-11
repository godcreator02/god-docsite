# A standalone `defineCollections({ type: 'meta' })` collection always throws "Cannot convert undefined or null to object" (argument-name mismatch between the macro transform and the runtime)

## Environment

- fumadocs-mdx **15.4.7** (latest at the time of writing), fumadocs-core 16.17.1
- Vite 8.3.4, @react-router/dev 8.4.0, React 19.3, Node v24.14.1, Windows 11
- The same happens with the plain fumadocs React Router example (this repro is a trimmed copy of it)

## Symptom

Any page whose module graph touches a standalone meta collection (e.g. a route loader reading
`demo.entries`) returns a 500 on every request:

```
Internal server error: Cannot convert undefined or null to object
    at Object.entries (<anonymous>)
    at Object.meta (.../fumadocs-mdx/dist/runtime/server.js:50:36)
    at Module.meta (.../fumadocs-mdx/dist/runtime/macro.js:80:33)
    at eval (.../app/lib/source.ts:4:181)
```

The meta collection itself is the plain documented usage:

```ts
import { defineCollections } from 'fumadocs-mdx/macro';

export const demo = defineCollections({ type: 'meta', dir: 'data' });
```

`defineDocs({ ... })` is not affected — only a standalone `defineCollections({ type: 'meta', ... })`.

## Steps to reproduce

1. `pnpm install`
2. `pnpm dev` (serves at http://127.0.0.1:5199/)
3. Open http://127.0.0.1:5199/ — the route loader reads `demo.entries`, and the page returns 500
   with the stack above.

`app/lib/source.ts` holds the only collection; `app/routes/index.tsx` holds the only route.
`data/demo.json` is the only file the collection reads.

## Root cause

The macro transform and the runtime disagree on the argument name.

**The transform** (`dist/transform-*.js`, `generateMetaArg`) emits the glob under the key `meta:`.
This is the actual transformed output of `app/lib/source.ts` in this repro (fetched from the dev
server):

```js
export const demo = await __fdm.meta({
  base: "data",
  meta: /* #__PURE__ */ Object.assign({"./demo.json": __vite_glob_0_0 })
});
```

**The runtime** (`dist/runtime/macro.js`) reads the same argument under `entries`:

```js
async function meta(args) {
  return accessor(await create().meta("meta", args.base, args.entries));  // args.entries is undefined
}
```

`args.entries` is therefore `undefined`, and the underlying implementation in
`dist/runtime/server.js` calls `Object.entries(glob)` on it:

```js
meta(_name, base, glob) {
  return await Promise.all(Object.entries(glob).map(...));  // server.js:50
}
```

Note that the `docs` path is consistent (`docs(args)` reads `args.meta`, and `defineDocs` emits
`meta:`), which is why collections declared inside `defineDocs` work and only the standalone
`defineCollections({ type: 'meta', ... })` form breaks.

## Suggested fix

Make the two sides agree — either the transform should emit `entries:` for the standalone meta
form, or `meta(args)` in `dist/runtime/macro.js` should read `args.meta` (and pass it through as
the third parameter of `create().meta(...)`).
