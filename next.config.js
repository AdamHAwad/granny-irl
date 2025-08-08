/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standard Next.js build (will run server in Capacitor)
  trailingSlash: true,
  experimental: {
    esmExternals: 'loose'
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Add cache control headers for mobile apps
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig