import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

export function withCollab(config: NextConfig = {}): NextConfig {
  return createMDX()({ reactStrictMode: true, ...config })
}
