import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@dossier/api', '@dossier/core'],
};

export default nextConfig;
