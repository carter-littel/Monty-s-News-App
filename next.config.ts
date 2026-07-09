import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Default bottom-left position collides with the app's own Settings
  // button; the app's floating buttons take priority over this dev-only
  // overlay, so move it out of both bottom corners.
  devIndicators: {
    position: "top-left",
  },
};

export default nextConfig;
