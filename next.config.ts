import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/landing/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default createNextIntlPlugin()(nextConfig);
