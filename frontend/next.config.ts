import type { NextConfig } from "next";

// The frontend calls the Express backend directly via its full URL
// (NEXT_PUBLIC_API_URL, see src/lib/api.ts) — no proxy rewrites needed.
const nextConfig: NextConfig = {};

export default nextConfig;
