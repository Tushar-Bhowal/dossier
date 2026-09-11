import { describe, expect, it, vi } from 'vitest';
import { FetchPortError } from '@dossier/core';

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: vi.fn(async (hostname: string) => {
      if (hostname === 'evil-external.example') {
        return [{ address: '93.184.216.34', family: 4 }];
      }
      if (hostname === 'rebinds-to-private.example') {
        return [{ address: '10.0.0.5', family: 4 }];
      }
      throw new Error(`unexpected lookup for ${hostname}`);
    }),
  },
}));

const { assertUrlAllowed } = await import('@dossier/core');

describe('assertUrlAllowed', () => {
  it('rejects 127.0.0.1 by default', async () => {
    await expect(assertUrlAllowed('http://127.0.0.1:3000/')).rejects.toMatchObject({
      reason: 'blocked-host',
    });
  });

  it('accepts 127.0.0.1 when allowPrivateHosts is set (the batch CLI case, §9)', async () => {
    const url = await assertUrlAllowed('http://127.0.0.1:3000/', { allowPrivateHosts: true });
    expect(url.hostname).toBe('127.0.0.1');
  });

  it('rejects private, link-local and CGNAT IPv4 literals', async () => {
    await expect(assertUrlAllowed('http://10.1.2.3/')).rejects.toMatchObject({ reason: 'blocked-host' });
    await expect(assertUrlAllowed('http://172.16.0.1/')).rejects.toMatchObject({ reason: 'blocked-host' });
    await expect(assertUrlAllowed('http://192.168.1.1/')).rejects.toMatchObject({ reason: 'blocked-host' });
    await expect(assertUrlAllowed('http://169.254.1.1/')).rejects.toMatchObject({ reason: 'blocked-host' });
    await expect(assertUrlAllowed('http://100.64.0.1/')).rejects.toMatchObject({ reason: 'blocked-host' });
  });

  it('rejects the IPv6 loopback and link-local ranges', async () => {
    await expect(assertUrlAllowed('http://[::1]/')).rejects.toMatchObject({ reason: 'blocked-host' });
    await expect(assertUrlAllowed('http://[fe80::1]/')).rejects.toMatchObject({ reason: 'blocked-host' });
  });

  it('rejects non-http(s) schemes', async () => {
    await expect(assertUrlAllowed('file:///etc/passwd')).rejects.toMatchObject({ reason: 'disallowed-scheme' });
    await expect(assertUrlAllowed('ftp://example.com/')).rejects.toMatchObject({ reason: 'disallowed-scheme' });
  });

  it('allows a hostname that resolves to a public address', async () => {
    const url = await assertUrlAllowed('https://evil-external.example/');
    expect(url.hostname).toBe('evil-external.example');
  });

  it('blocks a hostname that resolves (e.g. via DNS rebinding) to a private address', async () => {
    await expect(assertUrlAllowed('https://rebinds-to-private.example/')).rejects.toThrow(FetchPortError);
  });
});
