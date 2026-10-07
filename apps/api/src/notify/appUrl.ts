// The public address of this deployment, which Telegram links and QStash calls point at. Locally it's
// unset (QStash and Telegram can't reach localhost) unless APP_URL names a tunnel.
export function appUrl(): string | undefined {
  const explicit = process.env.APP_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : undefined;
}
