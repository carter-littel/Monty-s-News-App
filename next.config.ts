import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Route/bundler info now lives in the app's own Settings page instead.
  devIndicators: false,
};

export default nextConfig;
