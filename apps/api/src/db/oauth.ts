import { createHash, randomBytes } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { getDb } from './mongo.js';

export const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_S = 30 * 24 * 60 * 60;
const CODE_TTL_MS = 10 * 60_000;

interface ClientDoc {
  _id: string;
  info: OAuthClientInformationFull;
  createdAt: Date;
}

interface CodeDoc {
  _id: string; // sha256 of the code
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  resource?: string;
  expiresAt: Date;
}

export interface TokenDoc {
  _id: string; // sha256 of the token
  kind: 'access' | 'refresh';
  userId: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  expiresAt: Date;
  createdAt: Date;
}

// Only hashes are stored: a leaked database copy holds no usable code or token.
export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

async function col<T extends { _id: string }>(name: string): Promise<Collection<T>> {
  return (await getDb()).collection<T>(name);
}

export async function getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
  return (await (await col<ClientDoc>('oauthClients')).findOne({ _id: clientId }))?.info;
}

export async function saveClient(info: OAuthClientInformationFull): Promise<void> {
  await (await col<ClientDoc>('oauthClients')).insertOne({ _id: info.client_id, info, createdAt: new Date() });
}

export async function createCode(fields: Omit<CodeDoc, '_id' | 'expiresAt'>): Promise<string> {
  const code = newSecret();
  await (await col<CodeDoc>('oauthCodes')).insertOne({ _id: hashSecret(code), ...fields, expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return code;
}

export async function findCode(code: string): Promise<CodeDoc | null> {
  return (await col<CodeDoc>('oauthCodes')).findOne({ _id: hashSecret(code), expiresAt: { $gt: new Date() } });
}

// Read and delete in one step: a code works once, even if two requests race with it.
export async function consumeCode(code: string): Promise<CodeDoc | null> {
  return (await col<CodeDoc>('oauthCodes')).findOneAndDelete({ _id: hashSecret(code), expiresAt: { $gt: new Date() } });
}

export async function issueTokens(
  grant: Pick<TokenDoc, 'userId' | 'clientId' | 'clientName' | 'scopes'>,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = newSecret();
  const refreshToken = newSecret();
  const now = Date.now();
  await (await col<TokenDoc>('oauthTokens')).insertMany([
    { _id: hashSecret(accessToken), kind: 'access', ...grant, expiresAt: new Date(now + ACCESS_TTL_S * 1000), createdAt: new Date(now) },
    { _id: hashSecret(refreshToken), kind: 'refresh', ...grant, expiresAt: new Date(now + REFRESH_TTL_S * 1000), createdAt: new Date(now) },
  ]);
  return { accessToken, refreshToken };
}

export async function findAccessToken(token: string): Promise<TokenDoc | null> {
  return (await col<TokenDoc>('oauthTokens')).findOne({ _id: hashSecret(token), kind: 'access', expiresAt: { $gt: new Date() } });
}

// Refresh tokens rotate: using one deletes it, and a new pair is issued.
export async function consumeRefreshToken(token: string): Promise<TokenDoc | null> {
  return (await col<TokenDoc>('oauthTokens')).findOneAndDelete({ _id: hashSecret(token), kind: 'refresh', expiresAt: { $gt: new Date() } });
}

export async function deleteToken(token: string, clientId: string): Promise<void> {
  await (await col<TokenDoc>('oauthTokens')).deleteOne({ _id: hashSecret(token), clientId });
}

export interface Grant {
  clientId: string;
  clientName: string;
  connectedAt: string;
}

// One row per app the user has connected and not disconnected (a live refresh token = still connected).
export async function listGrants(userId: string): Promise<Grant[]> {
  const rows = await (await col<TokenDoc>('oauthTokens'))
    .aggregate<{ _id: string; clientName: string; connectedAt: Date }>([
      { $match: { userId, kind: 'refresh', expiresAt: { $gt: new Date() } } },
      { $group: { _id: '$clientId', clientName: { $last: '$clientName' }, connectedAt: { $min: '$createdAt' } } },
      { $sort: { connectedAt: -1 } },
    ])
    .toArray();
  return rows.map((r) => ({ clientId: r._id, clientName: r.clientName, connectedAt: r.connectedAt.toISOString() }));
}

export async function revokeGrant(userId: string, clientId: string): Promise<number> {
  return (await (await col<TokenDoc>('oauthTokens')).deleteMany({ userId, clientId })).deletedCount;
}
