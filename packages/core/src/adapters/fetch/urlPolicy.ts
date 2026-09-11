import dns from 'node:dns/promises';
import net from 'node:net';
import { FetchPortError } from '../../ports/fetcher.js';

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inIpv4Range(ip: string, base: string, prefixLength: number): boolean {
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

// §11: reject private, loopback, link-local and CGNAT ranges — the ranges cloud metadata
// endpoints and internal services live in.
const BLOCKED_IPV4_RANGES: [string, number][] = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['100.64.0.0', 10], // CGNAT
  ['192.0.0.0', 24], // IETF protocol assignments
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
  ['0.0.0.0', 8],
];

function isBlockedIpv4(ip: string): boolean {
  return BLOCKED_IPV4_RANGES.some(([base, prefix]) => inIpv4Range(ip, base, prefix));
}

// The URL parser canonicalizes an IPv6 literal (zero-compression, lowercase) as a side effect of
// parsing it — reused here instead of writing a second normalizer, so "::1" and the fully-expanded
// "0:0:0:0:0:0:0:1" compare equal.
function canonicalizeIpv6(ip: string): string {
  try {
    return new URL(`http://[${ip}]`).hostname.slice(1, -1);
  } catch {
    return ip.toLowerCase();
  }
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = canonicalizeIpv6(ip);
  if (normalized === '::1' || normalized === '::') return true;
  const firstGroup = parseInt(normalized.split(':')[0] || '0', 16);
  if (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) return true; // fe80::/10 link-local
  if (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) return true; // fc00::/7 unique local
  const mapped = normalized.match(/^::ffff:([\da-f:.]+)$/);
  if (mapped) {
    const mappedIpv4 = mapped[1]!.includes('.') ? mapped[1]! : ipv4FromHex(mapped[1]!);
    if (mappedIpv4) return isBlockedIpv4(mappedIpv4);
  }
  return false;
}

// Handles the hex form of an IPv4-mapped address (::ffff:7f00:1), not just the dotted form.
function ipv4FromHex(hex: string): string | null {
  const parts = hex.split(':');
  if (parts.length !== 2) return null;
  const high = parseInt(parts[0]!, 16);
  const low = parseInt(parts[1]!, 16);
  if (Number.isNaN(high) || Number.isNaN(low)) return null;
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isBlockedIp(ip: string): boolean {
  return net.isIP(ip) === 4 ? isBlockedIpv4(ip) : isBlockedIpv6(ip);
}

export interface UrlPolicyOptions {
  allowPrivateHosts?: boolean;
}

// The §11-vs-§9 gate: production never sets ALLOW_PRIVATE_HOSTS, so real internet crawling stays
// SSRF-safe; the batch CLI (§9) sets it because its fixture "company sites" run on localhost.
export async function assertUrlAllowed(rawUrl: string, options: UrlPolicyOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchPortError(`invalid URL: ${rawUrl}`, 'disallowed-scheme');
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new FetchPortError(`disallowed URL scheme: ${url.protocol}`, 'disallowed-scheme');
  }
  if (options.allowPrivateHosts) {
    return url;
  }

  // url.hostname keeps the brackets for an IPv6 literal ("[::1]") — net.isIP doesn't recognize
  // that form, which used to silently fall through to a DNS lookup that always failed instead of
  // actually being checked against the blocklist.
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const ipVersion = net.isIP(hostname);
  const ips: string[] = ipVersion
    ? [hostname]
    : (await dns.lookup(hostname, { all: true }).catch(() => [])).map((r) => r.address);

  if (ips.length === 0) {
    throw new FetchPortError(`could not resolve host: ${hostname}`, 'blocked-host');
  }
  if (ips.some(isBlockedIp)) {
    throw new FetchPortError(`blocked host: ${hostname} resolves to a private/loopback/CGNAT address`, 'blocked-host');
  }
  return url;
}
