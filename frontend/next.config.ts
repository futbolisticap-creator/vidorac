import type { NextConfig } from "next";

const buildCommit = (
  process.env.CF_PAGES_COMMIT_SHA
  ?? process.env.NEXT_PUBLIC_BUILD_COMMIT
  ?? process.env.GITHUB_SHA
  ?? "local-development"
).slice(0, 12);

const nextConfig: NextConfig = {
  output: "export",
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
