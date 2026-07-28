/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['api.dicebear.com', 'avatars.githubusercontent.com'],
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      'pino-pretty': false,
      encoding: false,
    }
    return config
  },
  experimental: {
    serverComponentsExternalPackages: ['@coral-xyz/anchor'],
  },
}

module.exports = nextConfig
