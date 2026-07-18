import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist', 'sharp'],
  experimental: {
    // Typed/drawn signature PNGs as data URLs can exceed the default 1MB body limit.
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
