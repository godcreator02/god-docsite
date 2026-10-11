import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { PinBlock, PinTreeBlock } from './e8-blocks';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    PinBlock,
    PinTreeBlock,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
