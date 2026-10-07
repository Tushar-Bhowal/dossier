// RFC 8414: how an MCP client learns where to register, send the user to sign in, and swap a code
// for tokens. Served here because only /api/v1/* reaches the Express API, and this must live at the root.
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const oauth = `${origin}/api/v1/oauth`;
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${oauth}/authorize`,
      token_endpoint: `${oauth}/token`,
      registration_endpoint: `${oauth}/register`,
      revocation_endpoint: `${oauth}/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
      revocation_endpoint_auth_methods_supported: ["client_secret_post"],
      scopes_supported: ["tracker"],
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } },
  );
}
