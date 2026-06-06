import type { NextConfig } from "next";

// Proxy /api calls to the Express backend on :5000 during development,
// mirroring the old Vite dev-server proxy. Override the target with
// NEXT_PUBLIC_API_TARGET when the backend lives elsewhere.
const API_TARGET = process.env.NEXT_PUBLIC_API_TARGET || "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
