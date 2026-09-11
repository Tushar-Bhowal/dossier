import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const domainDir = fileURLToPath(new URL('../../packages/core/src/domain/', import.meta.url));

const IO_MODULE_PATTERN =
  /from\s+['"](?:node:)?(fs|http|https|net|dns|child_process|tls)(?:\/[^'"]*)?['"]/;

describe('domain/ stays pure — no I/O imports', () => {
  const files = readdirSync(domainDir).filter((f) => f.endsWith('.ts'));

  it('found the domain files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} does not import fs/http/https/net/dns/child_process/tls or global fetch`, () => {
      const source = readFileSync(path.join(domainDir, file), 'utf8');
      expect(source).not.toMatch(IO_MODULE_PATTERN);
      expect(source).not.toMatch(/\bfetch\s*\(/);
    });
  }
});
