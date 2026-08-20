import type { NextConfig } from "next";

const serviceBasePath = process.env.NODE_ENV === "production" ? "/app" : undefined;

const nextConfig: NextConfig = {
  // Vercel Services strips /app before the request reaches Next.js. Prefixing
  // generated assets keeps chunks and styles on the browser-facing service URL.
  assetPrefix: serviceBasePath,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
