import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF route enforces a 10 MiB file limit and bounded multipart overhead.
  // Middleware must retain that entire body; its default 10 MiB includes the envelope.
  experimental: { middlewareClientMaxBodySize: "11mb" },
};

export default nextConfig;
