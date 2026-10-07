import type { Request, Response } from 'express';
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { InvalidClientMetadataError, InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  ACCESS_TTL_S,
  consumeCode,
  consumeRefreshToken,
  deleteToken,
  findAccessToken,
  findCode,
  getClient,
  issueTokens,
  saveClient,
} from '../db/oauth.js';

// One permission covers everything an assistant can do: read the tracker and suggest updates.
export const MCP_SCOPE = 'tracker';

// The site's own origin as the caller sees it (Vercel puts the real scheme in x-forwarded-proto).
export function requestOrigin(req: Request): string {
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  return `${proto}://${req.get('x-forwarded-host') ?? req.get('host')}`;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:']);

// Where Dossier may send the browser back to with a code: https anywhere, http only on this computer
// (Claude Code, Cursor listen on localhost), or a desktop app's own scheme (cursor://, vscode://).
// Never a scheme that runs code in the page.
export function isSafeRedirect(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (BLOCKED_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === 'http:') return LOOPBACK.has(url.hostname);
  return true;
}

export function clientName(client: OAuthClientInformationFull): string {
  return client.client_name?.trim().slice(0, 60) || 'An AI app';
}

const clientsStore: OAuthRegisteredClientsStore = {
  getClient,
  // Dynamic client registration: any MCP client may register itself. That is safe because nothing is
  // granted until the user approves it on the consent screen, which shows where it will send them.
  async registerClient(client) {
    const full = client as OAuthClientInformationFull;
    if (!full.redirect_uris.length || !full.redirect_uris.every(isSafeRedirect)) {
      throw new InvalidClientMetadataError('redirect_uris must be https, http on localhost, or an app scheme');
    }
    await saveClient(full);
    return full;
  },
};

function toTokens(tokens: { accessToken: string; refreshToken: string }, scopes: string[]): OAuthTokens {
  return {
    access_token: tokens.accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_S,
    refresh_token: tokens.refreshToken,
    scope: scopes.join(' '),
  };
}

// The SDK's /authorize, /token, /register and /revoke handlers do the protocol checks (parameter
// shapes, registered redirect URI, PKCE S256 verification); this provider decides and remembers.
export const oauthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  // Send the browser to Dossier's consent screen. The code is only created once the signed-in user
  // presses Allow there (POST /api/v1/oauth/consent).
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    const query = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      scope: MCP_SCOPE,
    });
    if (params.state) query.set('state', params.state);
    if (params.resource) query.set('resource', params.resource.href);
    res.redirect(302, `/connect/authorize?${query}`);
  },

  async challengeForAuthorizationCode(client, authorizationCode) {
    const code = await findCode(authorizationCode);
    if (!code || code.clientId !== client.client_id) throw new InvalidGrantError('invalid or expired code');
    return code.codeChallenge;
  },

  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri) {
    const code = await consumeCode(authorizationCode);
    if (!code || code.clientId !== client.client_id) throw new InvalidGrantError('invalid or expired code');
    if (redirectUri && redirectUri !== code.redirectUri) throw new InvalidGrantError('redirect_uri does not match');
    const tokens = await issueTokens({ userId: code.userId, clientId: client.client_id, clientName: clientName(client), scopes: code.scopes });
    return toTokens(tokens, code.scopes);
  },

  async exchangeRefreshToken(client, refreshToken) {
    const old = await consumeRefreshToken(refreshToken);
    if (!old || old.clientId !== client.client_id) throw new InvalidGrantError('invalid or expired refresh token');
    const tokens = await issueTokens({ userId: old.userId, clientId: old.clientId, clientName: old.clientName, scopes: old.scopes });
    return toTokens(tokens, old.scopes);
  },

  async verifyAccessToken(token): Promise<AuthInfo> {
    const doc = await findAccessToken(token);
    if (!doc) throw new InvalidTokenError('invalid or expired token');
    return {
      token,
      clientId: doc.clientId,
      scopes: doc.scopes,
      expiresAt: Math.floor(doc.expiresAt.getTime() / 1000),
      extra: { userId: doc.userId, clientName: doc.clientName },
    };
  },

  async revokeToken(client, request: OAuthTokenRevocationRequest) {
    await deleteToken(request.token, client.client_id);
  },
};
