import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'packages/**/*.spec.ts', 'apps/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/apps/web/**', '**/.next/**'],
    passWithNoTests: true,
  },
});
