// RFC 9728: tells an MCP client that /api/v1/mcp is protected and which server signs people in.
// Answers both /.well-known/oauth-protected-resource and …/api/v1/mcp, since clients try either.
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      resource: `${origin}/api/v1/mcp`,
      authorization_servers: [origin],
      scopes_supported: ["tracker"],
      bearer_methods_supported: ["header"],
      resource_name: "Dossier",
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } },
  );
}
