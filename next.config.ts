import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
  // The PDF route enforces a 10 MiB file limit and bounded multipart overhead.
  // Middleware must retain that entire body; its default 10 MiB includes the envelope.
  experimental: { middlewareClientMaxBodySize: "11mb" },
};

export default nextConfig;
