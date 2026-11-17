import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dc/contracts", "@dc/design-tokens"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000"}/api/:path*`,
      },
    ];
  },
  // Keep the development indicator away from the sidebar's help/profile actions.
  devIndicators: { position: "bottom-right" },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "02bf-103-188-169-119.ngrok-free.app",
  ],
};

export default nextConfig;
