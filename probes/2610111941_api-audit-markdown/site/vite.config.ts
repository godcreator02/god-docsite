import { defineConfig } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
export default defineConfig({ plugins: [fumadocsMdx()], cacheDir: '../out/vite-cache', resolve: { tsconfigPaths: true } });
