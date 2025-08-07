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
  }
}

module.exports = nextConfig