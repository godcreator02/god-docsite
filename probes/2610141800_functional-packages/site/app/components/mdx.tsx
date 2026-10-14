import defaultMdxComponents from '@fumadocs/base-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { DemoCounter } from 'demo-content/site';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    DemoCounter,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
