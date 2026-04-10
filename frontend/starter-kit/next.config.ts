import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

/** App root — fixes Tailwind `@import 'tailwindcss/...'` when workspace root is inferred as `pharma/frontend`. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot
  },
  webpack: config => {
    const tailwindRoot = path.join(projectRoot, 'node_modules/tailwindcss')
    config.resolve.alias = {
      ...config.resolve.alias,
      'tailwindcss/theme.css': path.join(tailwindRoot, 'theme.css'),
      'tailwindcss/utilities.css': path.join(tailwindRoot, 'utilities.css')
    }
    return config
  },
  basePath: process.env.BASEPATH,
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: true,
        locale: false
      }
    ]
  }
}

export default nextConfig
