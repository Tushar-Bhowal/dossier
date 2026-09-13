import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Next only loads `.env*` from its own directory, so without this the monorepo would need the same
// secrets duplicated in `apps/web/.env.local` — a gitignored file nobody cloning the repo gets,
// which made `npm run dev` fail on a clean checkout even after following the README's
// `cp .env.example .env` step. One root `.env` is the single source of truth for the web app, the
// API mounted inside it, and the batch CLI alike. Guarded the same way the batch CLI guards its own
// call: a deployed environment (Vercel) injects real env vars and has no checked-out file to read.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // No root .env present — process.env is used as-is.
}

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
      { source: '/kits/new', destination: '/kits?new=true', permanent: false },
    ];
  },
};

export default nextConfig;
