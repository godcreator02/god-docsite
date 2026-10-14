import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import { featurePackages } from './feature-packages.vite';

export default defineConfig({
  plugins: [fumadocsMdx(), tailwindcss(), featurePackages(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
