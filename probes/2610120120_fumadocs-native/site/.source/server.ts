// @ts-nocheck
import { frontmatter as __fd_glob_2 } from "../comments/20261012t080000-seed1/index.mdx?collection=comments&only=frontmatter"
import { frontmatter as __fd_glob_1 } from "../comments/20261012t080000-seed1/20261012t080500-r1a2.mdx?collection=comments&only=frontmatter"
import { frontmatter as __fd_glob_0 } from "../content/docs/index.mdx?collection=docs&only=frontmatter"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docsLazy("docs", "content/docs", {}, {"index.mdx": __fd_glob_0, }, {"index.mdx": () => import("../content/docs/index.mdx?collection=docs"), });

export const comments = await create.docLazy("comments", "comments", {"20261012t080000-seed1/20261012t080500-r1a2.mdx": __fd_glob_1, "20261012t080000-seed1/index.mdx": __fd_glob_2, }, {"20261012t080000-seed1/20261012t080500-r1a2.mdx": () => import("../comments/20261012t080000-seed1/20261012t080500-r1a2.mdx?collection=comments"), "20261012t080000-seed1/index.mdx": () => import("../comments/20261012t080000-seed1/index.mdx?collection=comments"), });