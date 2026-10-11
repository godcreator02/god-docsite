import { defineCollections } from 'fumadocs-mdx/macro';

/** 唯一的集合：一个 meta 集合。defineDocs 的内置 meta 集合不受影响，这里只用 defineCollections */
export const demo = defineCollections({ type: 'meta', dir: 'data' });
