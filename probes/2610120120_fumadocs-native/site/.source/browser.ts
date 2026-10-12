// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"index.mdx": () => import("../content/docs/index.mdx?collection=docs"), }),
  comments: create.doc("comments", {"20261012t080000-seed1/20261012t080500-r1a2.mdx": () => import("../comments/20261012t080000-seed1/20261012t080500-r1a2.mdx?collection=comments"), "20261012t080000-seed1/index.mdx": () => import("../comments/20261012t080000-seed1/index.mdx?collection=comments"), }),
};
export default browserCollections;