import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // For Vercel serverless functions
  serverExternalPackages: ["puppeteer", "@sparticuz/chromium"],
  // Increase function timeout for VULMS login
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
