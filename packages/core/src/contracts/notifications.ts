import { z } from 'zod';

// Shown to the user. Only the built ones can be switched on; the rest answer "Coming soon".
export const NOTIFICATION_CHANNELS = ['telegram', 'webpush', 'email', 'whatsapp', 'sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const BuiltChannel = z.enum(['telegram', 'webpush']);
export type BuiltChannel = z.infer<typeof BuiltChannel>;

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const MIN_REMINDER_OFFSET = 10;
export const MAX_REMINDER_OFFSET = 1440;

// Minutes before an interview, e.g. [120, 30]. Empty means no interview reminders.
export const ReminderOffsetsMin = z.array(z.int().min(MIN_REMINDER_OFFSET).max(MAX_REMINDER_OFFSET)).max(3);

export const NotificationPrefs = z.object({
  enabled: z.array(BuiltChannel).max(2),
  timezone: z.string().min(1).max(64).refine(isTimeZone, 'unknown time zone'),
  reminderOffsetsMin: ReminderOffsetsMin,
  digest: z.boolean(),
  digestHour: z.int().min(0).max(23),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: [],
  timezone: 'Asia/Kolkata',
  reminderOffsetsMin: [120, 30],
  digest: true,
  digestHour: 8,
};

// Settings saved before reminder times existed had two switches: 2 hours and 30 minutes before.
export function normalizePrefs(raw: Partial<NotificationPrefs> & { remind2h?: boolean; remind30m?: boolean }): NotificationPrefs {
  const { remind2h, remind30m, ...rest } = raw;
  const legacy = [...(remind2h === false ? [] : [120]), ...(remind30m === false ? [] : [30])];
  return { ...DEFAULT_PREFS, ...rest, reminderOffsetsMin: rest.reminderOffsetsMin ?? legacy };
}

export const PushSubscriptionInput = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInput>;

export const PushUnsubscribe = z.object({ endpoint: z.string().max(1000) });

export interface NotificationSettingsView {
  saved: boolean;
  prefs: NotificationPrefs;
  telegram: { linked: boolean; linkedAt?: string };
  webpushDevices: string[];
  // What this server has keys for; a channel without its keys can't be connected.
  available: { telegram: boolean; webpush: boolean; reminders: boolean };
  vapidPublicKey?: string;
}

export interface TestResult {
  channel: BuiltChannel;
  ok: boolean;
}
