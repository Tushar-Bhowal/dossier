import express, { Router } from 'express';
import { z } from 'zod';
import { authorizationHandler, redirectUriMatches } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { revocationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/revoke.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { createCode, getClient, listGrants, revokeGrant } from '../db/oauth.js';
import { MCP_SCOPE, clientName, isSafeRedirect, oauthProvider } from '../mcp/oauth.js';

export const oauthRouter = Router();

// The SDK's in-memory rate limiter is off: on serverless every instance has its own memory, so it
// would limit nothing. Secrets never expire (0), so a connected assistant isn't cut off after a month.
oauthRouter.use('/authorize', authorizationHandler({ provider: oauthProvider, rateLimit: false }));
oauthRouter.use('/token', tokenHandler({ provider: oauthProvider, rateLimit: false }));
oauthRouter.use('/register', clientRegistrationHandler({ clientsStore: oauthProvider.clientsStore, rateLimit: false, clientSecretExpirySeconds: 0 }));
oauthRouter.use('/revoke', revocationHandler({ provider: oauthProvider, rateLimit: false }));

// What the consent screen shows. The name is whatever the app registered itself as, so the screen
// also shows the address it will send you back to, which the app can't fake.
oauthRouter.get('/clients/:id', requireAuth, async (req, res, next) => {
  try {
    const client = await getClient(req.params.id as string);
    if (!client) {
      next(new AppError(404, 'not_found', 'unknown app'));
      return;
    }
    const redirect = client.redirect_uris[0] ?? '';
    let redirectHost = redirect;
    try {
      const url = new URL(redirect);
      redirectHost = url.host || url.protocol;
    } catch {
      // shown as registered
    }
    res.json({ name: clientName(client), redirectHost });
  } catch (err) {
    next(err);
  }
});

const ConsentForm = z.object({
  decision: z.enum(['allow', 'deny']),
  client_id: z.string().min(1).max(200),
  redirect_uri: z.string().min(1).max(2000),
  code_challenge: z.string().min(43).max(128),
  state: z.string().max(1000).optional(),
  resource: z.string().max(2000).optional(),
});

// A plain HTML form POST from the consent page, answered with a redirect. The session cookie is
// SameSite=Lax, so another site can't submit this form as the user. Every value came through the
// browser, so the client, redirect URI and PKCE challenge are all checked again here.
oauthRouter.post('/consent', express.urlencoded({ extended: false }), requireAuth, async (req, res, next) => {
  const form = ConsentForm.safeParse(req.body);
  if (!form.success) {
    next(new AppError(400, 'validation_error', form.error.message));
    return;
  }
  const { decision, client_id, redirect_uri, code_challenge, state, resource } = form.data;
  try {
    const client = await getClient(client_id);
    if (!client || !client.redirect_uris.some((r) => redirectUriMatches(redirect_uri, r)) || !isSafeRedirect(redirect_uri)) {
      next(new AppError(400, 'invalid_request', 'unknown app or redirect address'));
      return;
    }
    const target = new URL(redirect_uri);
    if (decision === 'deny') {
      target.searchParams.set('error', 'access_denied');
    } else {
      const code = await createCode({
        clientId: client_id,
        userId: req.userId!,
        codeChallenge: code_challenge,
        redirectUri: redirect_uri,
        scopes: [MCP_SCOPE],
        ...(resource ? { resource } : {}),
      });
      target.searchParams.set('code', code);
    }
    if (state) target.searchParams.set('state', state);
    res.redirect(302, target.href);
  } catch (err) {
    next(err);
  }
});

// The "AI assistants" page: which apps are connected, and disconnecting one.
export const assistantsRouter = Router();
assistantsRouter.use(requireAuth);

assistantsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listGrants(req.userId!));
  } catch (err) {
    next(err);
  }
});

assistantsRouter.delete('/:clientId', async (req, res, next) => {
  try {
    await revokeGrant(req.userId!, req.params.clientId as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
