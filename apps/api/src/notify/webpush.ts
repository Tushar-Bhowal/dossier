import webpush from 'web-push';
import type { NotificationMessage } from '@dossier/core';
import type { PushSub } from '../db/notifications.js';
import type { SendOutcome } from './telegram.js';

export function webpushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

let vapidSet = false;

// VAPID = our server's key pair. The browser subscribed with the public key, and the push service
// (Google's, Mozilla's or Apple's) only accepts messages signed with the matching private key.
function ensureVapid(): void {
  if (vapidSet) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidSet = true;
}

export async function sendPush(sub: PushSub, message: NotificationMessage, ttlSeconds: number): Promise<SendOutcome> {
  ensureVapid();
  try {
    // The payload is encrypted for this one browser (its p256dh + auth keys); the push service
    // carries it without being able to read it. Our service worker (public/sw.js) shows it.
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify({ title: message.title, body: message.body, path: message.path }),
      // A reminder that couldn't reach a phone that was off for longer than this is no longer useful.
      { TTL: ttlSeconds, urgency: 'high', timeout: 10_000 },
    );
    return 'sent';
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410: the subscription is gone (permission revoked, browser data cleared). Delete it.
    if (status === 404 || status === 410) return 'gone';
    console.error(`web push failed: ${status ?? ''}`, err instanceof Error ? err.message : err);
    return 'failed';
  }
}
