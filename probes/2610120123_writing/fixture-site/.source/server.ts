// @ts-nocheck
/// <reference types="vite/client" />
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docsLazy("docs", "content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/docs",
  "query": "?collection=docs",
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/docs",
  "query": "?collection=docs&only=frontmatter",
  "import": "frontmatter",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/docs",
  "query": "?collection=docs",
  "eager": false
}));

export const notes = await create.docsLazy("notes", "content/notes", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/notes",
  "query": "?collection=notes",
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/notes",
  "query": "?collection=notes&only=frontmatter",
  "import": "frontmatter",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/notes",
  "query": "?collection=notes",
  "eager": false
}));