import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly set the Turbopack root to avoid confusion with parent directory lockfile
  turbopack: {
    root: __dirname,
  },

  // Performance optimizations
  experimental: {
    // Inline CSS to reduce round trips
    inlineCss: true,
  },

  // Optimize package imports
  transpilePackages: [],

  // Reduce recompilation
  webpack: (config, { dev, isServer }) => {
    // Speed up hot reloading in dev
    if (dev && !isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules', '**/.git', '**/.next'],
      };
    }
    return config;
  },

  // PWA support
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
