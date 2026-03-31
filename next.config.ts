import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence the "webpack config but no turbopack config" warning.
  turbopack: {},
};

export default nextConfig;
