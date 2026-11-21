import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/creators/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      ],
    },
  ],
  experimental: {
    // 5 MiB image plus multipart boundaries/metadata. File bytes are checked again.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
