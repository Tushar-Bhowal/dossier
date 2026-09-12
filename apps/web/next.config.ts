import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@dossier/api', '@dossier/core'],
  // @dossier/api and @dossier/core are TS source using Node ESM-style relative imports
  // (`./foo.js` resolving to `./foo.ts`), which tsx/Node's loader handle natively but
  // Next's own resolver doesn't by default — this maps the extension the same way.
  experimental: {
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js'],
    },
  },
  async redirects() {
    return [
      { source: '/login', destination: '/?mode=login', permanent: false },
      { source: '/register', destination: '/?mode=register', permanent: false },
    ];
  },
};

export default nextConfig;
