import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // 5 MiB image plus multipart boundaries/metadata. File bytes are checked again.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
