import { timingSafeEqual } from 'node:crypto';
import type { NotificationMessage } from '@dossier/core';
import { appUrl } from './appUrl.js';

export type SendOutcome = 'sent' | 'gone' | 'failed';

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET);
}

// Every Bot API method is a POST to api.telegram.org/bot<token>/<method> with a JSON body, and every
// answer is { ok, result } or { ok: false, error_code, description }.
async function call(method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  return { ok: res.ok && body?.ok === true, status: res.status, description: body?.description };
}

export async function sendTelegramText(chatId: number, text: string): Promise<void> {
  await call('sendMessage', { chat_id: chatId, text });
}

export async function sendTelegram(chatId: number, message: NotificationMessage): Promise<SendOutcome> {
  const base = appUrl();
  // Telegram refuses buttons that point at http:// or localhost, so the button only exists on a real deployment.
  const button = base?.startsWith('https://')
    ? { reply_markup: { inline_keyboard: [[{ text: 'Open in Dossier', url: `${base}${message.path}` }]] } }
    : {};
  try {
    // Plain text, no parse_mode: company names with * or _ would otherwise break Markdown parsing.
    const result = await call('sendMessage', { chat_id: chatId, text: `${message.title}\n\n${message.body}`, ...button });
    if (result.ok) return 'sent';
    // 403: the user blocked the bot or deleted the chat. Retrying can never work.
    if (result.status === 403) return 'gone';
    console.error(`telegram sendMessage failed: ${result.status} ${result.description ?? ''}`);
    return 'failed';
  } catch (err) {
    console.error('telegram sendMessage error', err);
    return 'failed';
  }
}

export function telegramLinkUrl(token: string): string {
  return `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;
}

// Telegram sends back the secret we gave setWebhook in this header; anything without it is not Telegram.
export function isTelegramSecret(header: string | undefined): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
