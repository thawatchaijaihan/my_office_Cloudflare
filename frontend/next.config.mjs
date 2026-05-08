/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['async_hooks', 'node:async_hooks'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.prebuiltui.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/map-cctv",
        destination: "/cctv-map",
      },
      // Proxy API calls to Cloudflare Worker backend
      {
        source: "/api/:path*",
        destination: "https://api.capt-th.work/api/:path*",
      },
    ];
  },
};

export default nextConfig;
