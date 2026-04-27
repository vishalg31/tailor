/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Node-only packages out of the client bundle
  serverExternalPackages: ['canvas', 'pdf-parse', 'mammoth'],
  // Silence the empty turbopack config warning
  turbopack: {},
}

module.exports = nextConfig
