// @ts-nocheck
/// <reference types="vite/client" />
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  auditA: create.doc("auditA", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../content/audit-a",
    "query": "?collection=auditA",
    "eager": false
  })),
  auditB: create.doc("auditB", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../content/audit-b",
    "query": "?collection=auditB",
    "eager": false
  })),
};
export default browserCollections;