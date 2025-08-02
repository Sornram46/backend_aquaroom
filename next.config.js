/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/admin/:path*',
        destination: '/admin',
      },
    ];
  },
  images: {
    domains: ['localhost', 'aquaroom.com'],
  },
};

module.exports = nextConfig;