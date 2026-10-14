import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { featurePackages } from './feature-packages.vite';

export default defineConfig({
  plugins: [
    fumadocsMdx({
      globalOptions: {
        mdxOptions: { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] },
      },
    }),
    tailwindcss(),
    featurePackages(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
