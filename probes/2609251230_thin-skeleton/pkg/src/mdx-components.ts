import type { MDXComponents } from 'mdx/types'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { TreeProbe } from './ui.js'

export function createMdxComponents(projectComponents: MDXComponents): MDXComponents {
  return { ...defaultMdxComponents, TreeProbe, ...projectComponents }
}
