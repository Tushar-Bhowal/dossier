"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, LoaderCircle, Mail, MessageCircle, MessageSquareText, Send, Smartphone } from "lucide-react";
import type { NotificationPrefs, NotificationSettingsView } from "@dossier/core/applications";
import {
  ApiError,
  createTelegramLink,
  disconnectTelegram,
  getNotificationSettings,
  removePushSubscription,
  saveNotificationPrefs,
  savePushSubscription,
  sendTestNotification,
} from "@/lib/api";
import { currentSubscription, pushSupport, subscribeThisDevice, unsubscribeThisDevice } from "@/lib/push";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ReminderTimes } from "./ReminderTimes";

const KEY = ["notification-settings"];
const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.08em] text-white/45";
const TELEGRAM_WAIT_MS = 2 * 60_000;

function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${hour < 12 ? "am" : "pm"}`;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        checked ? "bg-primary" : "bg-white/15",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0")}
      />
    </button>
  );
}

function ChannelCard({
  icon: Icon,
  name,
  status,
  children,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  status: React.ReactNode;
  children?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li className={cn("flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4", muted && "bg-transparent")}>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", muted ? "bg-white/[0.04] text-white/40" : "bg-primary/15 text-[#ff7a5c]")} aria-hidden>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] font-semibold", muted ? "text-white/60" : "text-white")}>{name}</p>
        <div className="text-sm font-medium text-white/55">{status}</div>
      </div>
      {children}
    </li>
  );
}

function SheetBody() {
  const queryClient = useQueryClient();
  const [telegramWaitUntil, setTelegramWaitUntil] = React.useState(0);
  const [busy, setBusy] = React.useState<null | "telegram" | "push" | "test">(null);

  const { data: view, isLoading, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: getNotificationSettings,
    // After "Connect Telegram", check every few seconds until the bot reports the link.
    refetchInterval: (query) => (!query.state.data?.telegram.linked && Date.now() < telegramWaitUntil ? 3000 : false),
  });
  const { data: deviceEndpoint } = useQuery({ queryKey: ["push-device"], queryFn: async () => (await currentSubscription())?.endpoint ?? null });

  const setView = (next: NotificationSettingsView) => queryClient.setQueryData(KEY, next);

  // First visit: store the browser's time zone so reminders and the summary use local time.
  const savedOnce = React.useRef(false);
  React.useEffect(() => {
    if (!view || view.saved || savedOnce.current) return;
    savedOnce.current = true;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void saveNotificationPrefs({ ...view.prefs, timezone }).then((next) => queryClient.setQueryData(KEY, next));
  }, [view, queryClient]);

  if (isLoading) {
    return (
      <div className="mt-6 flex flex-col gap-3" role="status" aria-label="Loading reminders">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-lg" />
        ))}
      </div>
    );
  }
  if (isError || !view) {
    return (
      <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-500/[0.06] p-4">
        <p className="text-[15px] font-medium text-red-200">Couldn&apos;t load your reminder settings.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const prefs = view.prefs;
  const support = pushSupport();
  const pushOnHere = Boolean(deviceEndpoint && view.webpushDevices.includes(deviceEndpoint));
  const otherDevices = view.webpushDevices.length - (pushOnHere ? 1 : 0);

  function savePrefs(patch: Partial<NotificationPrefs>) {
    const next = { ...prefs, ...patch };
    setView({ ...view!, prefs: next });
    saveNotificationPrefs(next).then(setView, () => {
      toast.error("Couldn't save that", { description: "Check your connection and try again." });
      void refetch();
    });
  }

  async function connectTelegram() {
    setBusy("telegram");
    // Opened before the request finishes so the browser doesn't treat it as an unwanted pop-up.
    const tab = window.open("", "_blank");
    try {
      const { url } = await createTelegramLink();
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setTelegramWaitUntil(Date.now() + TELEGRAM_WAIT_MS);
      void refetch();
    } catch (err) {
      tab?.close();
      toast.error("Couldn't start the Telegram link", { description: err instanceof ApiError ? err.message : "Try again in a moment." });
    } finally {
      setBusy(null);
    }
  }

  async function turnOffTelegram() {
    setBusy("telegram");
    try {
      setView(await disconnectTelegram());
      toast.success("Telegram disconnected");
    } catch {
      toast.error("Couldn't disconnect Telegram");
    } finally {
      setBusy(null);
    }
  }

  async function turnOnPush() {
    if (!view?.vapidPublicKey) return;
    setBusy("push");
    try {
      const sub = await subscribeThisDevice(view.vapidPublicKey);
      setView(await savePushSubscription(sub));
      queryClient.setQueryData(["push-device"], sub.endpoint);
      toast.success("Notifications are on for this device");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error("Couldn't turn on notifications", {
        description:
          message === "blocked"
            ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
            : message === "dismissed"
              ? "The permission prompt was closed. Press Turn on again and choose Allow."
              : "Try again in a moment.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function turnOffPush() {
    setBusy("push");
    try {
      const endpoint = await unsubscribeThisDevice();
      if (endpoint) setView(await removePushSubscription(endpoint));
      queryClient.setQueryData(["push-device"], null);
      toast.success("Notifications are off for this device");
    } catch {
      toast.error("Couldn't turn off notifications");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    try {
      const results = await sendTestNotification();
      const failed = results.filter((r) => !r.ok).map((r) => (r.channel === "telegram" ? "Telegram" : "this browser"));
      if (failed.length) toast.error("Some test messages didn't arrive", { description: `Couldn't reach ${failed.join(" and ")}.` });
      else toast.success("Test sent", { description: "Check your notifications." });
      void refetch();
    } catch {
      toast.error("Couldn't send a test");
    } finally {
      setBusy(null);
    }
  }

  const comingSoon = (name: string) => () => toast.info(`${name} reminders are coming soon`, { description: "Use Telegram or browser notifications for now." });
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <>
      {!view.available.reminders && (
        <p className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm font-medium text-amber-200">
          Scheduled reminders aren&apos;t set up on this server, so only test messages are sent here.
        </p>
      )}

      <section className="mt-6 flex flex-col gap-3" aria-labelledby="channels-heading">
        <h3 id="channels-heading" className={sectionTitle}>
          Where to remind you
        </h3>
        <ul className="flex flex-col gap-2">
          <ChannelCard
            icon={Send}
            name="Telegram"
            status={
              !view.available.telegram ? (
                "Not set up on this server"
              ) : view.telegram.linked ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Check className="size-3.5" aria-hidden /> Connected
                </span>
              ) : telegramWaitUntil > 0 ? (
                "Press Start in Telegram, then come back here"
              ) : (
                "Free. Messages from the Dossier bot."
              )
            }
          >
            {view.available.telegram &&
              (view.telegram.linked ? (
                <Button variant="ghost" size="sm" onClick={turnOffTelegram} disabled={busy === "telegram"}>
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" onClick={connectTelegram} disabled={busy === "telegram"}>
                  {busy === "telegram" && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
                  Connect
                </Button>
              ))}
          </ChannelCard>

          <ChannelCard
            icon={Smartphone}
            name="Browser notifications"
            status={
              !view.available.webpush
                ? "Not set up on this server"
                : support === "needs-home-screen"
                  ? "On iPhone: Share → Add to Home Screen, then open Dossier from there"
                  : support === "unsupported"
                    ? "This browser can't show notifications"
                    : pushOnHere
                      ? `On for this device${otherDevices > 0 ? ` and ${otherDevices} other${otherDevices > 1 ? "s" : ""}` : ""}`
                      : otherDevices > 0
                        ? `On for ${otherDevices} other device${otherDevices > 1 ? "s" : ""}`
                        : "Shows on this device, even with Dossier closed"
            }
          >
            {view.available.webpush &&
              support === "supported" &&
              (pushOnHere ? (
                <Button variant="ghost" size="sm" onClick={turnOffPush} disabled={busy === "push"}>
                  Turn off
                </Button>
              ) : (
                <Button size="sm" onClick={turnOnPush} disabled={busy === "push"}>
                  {busy === "push" && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
                  Turn on
                </Button>
              ))}
          </ChannelCard>

          {[
            { name: "Email", icon: Mail },
            { name: "WhatsApp", icon: MessageCircle },
            { name: "SMS", icon: MessageSquareText },
          ].map((c) => (
            <ChannelCard key={c.name} icon={c.icon} name={c.name} status="Coming soon" muted>
              <Button variant="ghost" size="sm" onClick={comingSoon(c.name)}>
                Notify me
              </Button>
            </ChannelCard>
          ))}
        </ul>
      </section>

      <section className="mt-7 flex flex-col gap-3" aria-labelledby="when-heading">
        <h3 id="when-heading" className={sectionTitle}>
          When
        </h3>
        <div className="flex flex-col divide-y divide-white/[0.06] rounded-lg border border-white/[0.08]">
          <div className="flex flex-col gap-3 px-4 py-3.5">
            <span className="text-[15px] font-medium text-white/85">
              Before each interview
            </span>
            <ReminderTimes
              label="Reminder times before each interview"
              value={prefs.reminderOffsetsMin}
              onChange={(reminderOffsetsMin) => savePrefs({ reminderOffsetsMin })}
            />
          </div>
          <div className="flex flex-col gap-3 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-medium text-white/85">Morning summary</span>
              <Toggle label="Morning summary" checked={prefs.digest} onChange={(v) => savePrefs({ digest: v })} />
            </div>
            {prefs.digest && (
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white/60">
                <span>Today&apos;s interviews and follow-ups, at</span>
                <select
                  aria-label="Summary time"
                  value={prefs.digestHour}
                  onChange={(e) => savePrefs({ digestHour: Number(e.target.value) })}
                  className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm font-semibold text-white [color-scheme:dark]"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
            <label htmlFor="tz" className="text-[15px] font-medium text-white/85">
              Time zone
            </label>
            <select
              id="tz"
              value={prefs.timezone}
              onChange={(e) => savePrefs({ timezone: e.target.value })}
              className="h-9 max-w-[220px] rounded-lg border border-input bg-transparent px-2 text-sm font-semibold text-white [color-scheme:dark]"
            >
              {timezones.includes(prefs.timezone) ? null : <option value={prefs.timezone}>{prefs.timezone}</option>}
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="mt-7 flex flex-col gap-2 border-t border-white/[0.08] pt-5">
        <Button onClick={sendTest} disabled={!prefs.enabled.length || busy === "test"} className="self-start">
          {busy === "test" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Bell className="size-4" aria-hidden />}
          Send a test
        </Button>
        {!prefs.enabled.length && <p className="text-sm font-medium text-white/50">Connect Telegram or turn on browser notifications first.</p>}
      </div>
    </>
  );
}

export function NotificationsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="text-xl font-semibold tracking-[-0.02em] text-white">Reminders</SheetTitle>
        <SheetDescription className="mt-1 text-[15px] font-medium text-white/60">
          A nudge before every interview, and a short summary each morning.
        </SheetDescription>
        {open && <SheetBody />}
      </SheetContent>
    </Sheet>
  );
}
