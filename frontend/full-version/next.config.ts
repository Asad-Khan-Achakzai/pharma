import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

/** App root (where this next.config lives). Required so Tailwind CSS imports resolve when Next infers a parent folder like `pharma/frontend` as the workspace root. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // Prisma: avoid bundling the query engine twice in dev (full-version only; starter has no Prisma)
  serverExternalPackages: ['@prisma/client', 'prisma'],
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
  experimental: {
    // Smaller dev-time module graph for MUI-heavy apps (less RAM in next dev)
    optimizePackageImports: [
      '@mui/material',
      '@mui/lab',
      'recharts',
      '@tiptap/react',
      '@tiptap/starter-kit'
    ]
  },
  basePath: process.env.BASEPATH,
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/en/dashboards/crm',
        permanent: true,
        locale: false
      },
      {
        source: '/:lang(en|fr|ar)',
        destination: '/:lang/dashboards/crm',
        permanent: true,
        locale: false
      },
      {
        source: '/:path((?!en|fr|ar|front-pages|images|api|favicon.ico).*)*',
        destination: '/en/:path*',
        permanent: true,
        locale: false
      }
    ]
  }
}

export default nextConfig
