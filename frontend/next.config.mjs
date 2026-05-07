/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
      // Proxy API calls to Go backend
      {
        source: "/api/ping",
        destination: "http://server:8080/api/ping",
      },
      {
        source: "/api/search",
        destination: "http://server:8080/api/search",
      },
      {
        source: "/api/dashboard/:path*",
        destination: "http://server:8080/api/dashboard/:path*",
      },
      {
        source: "/api/admin/:path*",
        destination: "http://server:8080/api/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
