// @ts-nocheck
/// <reference types="vite/client" />
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const auditA = await create.docs("auditA", "content/audit-a", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/audit-a",
  "query": "?collection=auditA",
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/audit-a",
  "query": "?collection=auditA",
  "eager": true
}));

export const auditB = await create.docs("auditB", "content/audit-b", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/audit-b",
  "query": "?collection=auditB",
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/audit-b",
  "query": "?collection=auditB",
  "eager": true
}));