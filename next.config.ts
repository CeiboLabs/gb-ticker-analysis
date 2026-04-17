import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.7"],
  turbopack: {
    resolveAlias: {
      "@deno/shim-deno": "./lib/deno-shim-edge/index.js",
    },
  },
};

export default nextConfig;
