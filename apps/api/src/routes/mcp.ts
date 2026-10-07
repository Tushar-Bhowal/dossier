import { Router, type Request, type RequestHandler } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { buildMcpServer } from '../mcp/server.js';
import { MCP_SCOPE, oauthProvider, requestOrigin } from '../mcp/oauth.js';

// No valid token → 401 plus a pointer to the metadata that tells the client how to sign in. This
// header is how an MCP client discovers it needs OAuth and where to start.
const requireToken: RequestHandler = async (req, res, next) => {
  const metadata = `${requestOrigin(req)}/.well-known/oauth-protected-resource/api/v1/mcp`;
  const deny = (status: number, error?: string) => {
    res
      .status(status)
      .set('WWW-Authenticate', `Bearer resource_metadata="${metadata}"${error ? `, error="${error}"` : ''}`)
      .json({ error: error ?? 'unauthorized' });
  };
  const token = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '')?.[1];
  if (!token) return deny(401);
  let auth: AuthInfo;
  try {
    auth = await oauthProvider.verifyAccessToken(token);
  } catch {
    return deny(401, 'invalid_token');
  }
  if (!auth.scopes.includes(MCP_SCOPE)) return deny(403, 'insufficient_scope');
  // The transport reads req.auth and hands it to every tool as extra.authInfo.
  (req as Request & { auth?: AuthInfo }).auth = auth;
  next();
};

export const mcpRouter = Router();

mcpRouter.post('/', requireToken, async (req, res) => {
  const server = buildMcpServer();
  // Stateless: no session id, plain JSON answers. Every request stands alone, which suits serverless.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('mcp request failed', err);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
  }
});

// Stateless servers have no stream to open (GET) or session to end (DELETE).
mcpRouter.all('/', (_req, res) => {
  res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
});
