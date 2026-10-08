"use client";

import * as React from "react";
import { Tabs } from "radix-ui";
import { BellRing, CircleUser, Gauge, KeyRound, LogOut, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { DemoControls } from "@/components/demo/DemoControls";
import { ReminderSettings } from "@/components/applications/NotificationsSheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMe } from "@/hooks/use-me";
import { useSignOut } from "@/hooks/use-sign-out";
import { accountKeys } from "@/lib/account/api";
import { accountScenario } from "@/lib/account/demo/scenario";
import { cn } from "@/lib/utils";
import { ApiKeySection } from "./ApiKeySection";
import { DataSection } from "./DataSection";
import { Panel, SettingsSection } from "./parts";
import { UsageSection } from "./UsageSection";

export type SettingsTab = "account" | "usage" | "key" | "reminders" | "data";

const TABS: { value: SettingsTab; label: string; icon: LucideIcon }[] = [
  { value: "account", label: "Account", icon: CircleUser },
  { value: "usage", label: "Usage", icon: Gauge },
  { value: "key", label: "Your own key", icon: KeyRound },
  { value: "reminders", label: "Reminders", icon: BellRing },
  { value: "data", label: "Privacy and data", icon: ShieldCheck },
];

const SettingsContext = React.createContext<((tab?: SettingsTab) => void) | null>(null);

// Opens Settings on a tab from anywhere inside the app. Null outside the signed-in shell.
export function useOpenSettings() {
  return React.useContext(SettingsContext);
}

function isTab(value: string | null): value is SettingsTab {
  return TABS.some((t) => t.value === value);
}

// A link like /home?settings=data (e.g. from the privacy page) opens Settings on that tab.
function tabFromUrl(): SettingsTab | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("settings");
  return isTab(value) ? value : null;
}

function AccountSection() {
  const { data: user } = useMe();
  const signOut = useSignOut();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const email = user?.email ?? "";

  return (
    <SettingsSection id="account" title="Account" description="The email you sign in with.">
      <Panel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10 shrink-0 rounded-lg bg-[#dc3019]">
            <AvatarFallback className="rounded-lg bg-transparent text-sm font-bold text-white">
              {email.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/55">Signed in as</p>
            <p className="break-all text-[15px] font-semibold text-white">{email}</p>
          </div>
        </div>
        <Button variant="outline" className="h-11 shrink-0 sm:h-9" onClick={() => setConfirmOpen(true)}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </Panel>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign out of Dossier?"
        description="You'll need to sign in again to see your kits, applications and resumes."
        confirmLabel="Sign out"
        confirmingLabel="Signing out…"
        icon={<LogOut className="size-4" />}
        onConfirm={signOut}
      />
    </SettingsSection>
  );
}

function RemindersSection() {
  return (
    <SettingsSection
      id="reminders"
      title="Reminders"
      description="A message on Telegram or in your browser before each interview, plus an optional morning summary."
    >
      <div>
        <ReminderSettings />
      </div>
    </SettingsSection>
  );
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const initialTab = React.useState(tabFromUrl)[0];
  const [open, setOpen] = React.useState(initialTab !== null);
  const [tab, setTab] = React.useState<SettingsTab>(initialTab ?? "account");
  const isMobile = useIsMobile();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Drop ?settings= once read, so a reload or a shared link doesn't keep reopening it.
  React.useEffect(() => {
    if (!initialTab) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("settings");
    window.history.replaceState(window.history.state, "", url);
  }, [initialTab]);

  const openSettings = React.useCallback((next: SettingsTab = "account") => {
    setTab(next);
    setOpen(true);
  }, []);

  function changeTab(value: string) {
    if (!isTab(value)) return;
    setTab(value);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  return (
    <SettingsContext.Provider value={openSettings}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          aria-describedby="settings-description"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          className="flex h-dvh max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#111111] bg-none p-0 outline-none sm:max-w-full md:h-[min(760px,calc(100dvh-4rem))] md:max-w-[min(1040px,calc(100%-4rem))] md:rounded-lg md:border"
        >
          <DialogDescription id="settings-description" className="sr-only">
            Your account, daily AI use, your own key, reminders and your data.
          </DialogDescription>
          <Tabs.Root
            value={tab}
            onValueChange={changeTab}
            orientation={isMobile ? "horizontal" : "vertical"}
            className="flex min-h-0 flex-1 flex-col md:flex-row"
          >
            <div className="shrink-0 border-b border-white/[0.08] bg-white/[0.02] md:w-[248px] md:border-b-0 md:border-r md:p-4">
              <div className="flex items-center justify-between px-4 pt-3 md:px-2 md:pb-3 md:pt-1">
                <DialogTitle className="text-lg font-semibold tracking-[-0.02em] text-white md:text-[15px] md:font-semibold md:text-white/55">
                  Settings
                </DialogTitle>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" aria-label="Close settings" className="size-11 text-white/70 md:hidden">
                    <X className="size-5" />
                  </Button>
                </DialogClose>
              </div>
              <Tabs.List
                aria-label="Settings sections"
                className="flex gap-1 overflow-x-auto px-3 pb-3 pt-1 [scrollbar-width:none] md:flex-col md:overflow-visible md:p-0"
              >
                {TABS.map(({ value, label, icon: Icon }) => (
                  <Tabs.Trigger
                    key={value}
                    value={value}
                    className={cn(
                      "flex h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-white/65 outline-none transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50",
                      "data-[state=active]:bg-white/[0.07] data-[state=active]:text-white data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                      "[&[data-state=active]>svg]:text-[#ff7a5c]",
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                    {label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </div>

            <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close settings"
                  className="absolute right-4 top-4 z-10 hidden size-11 text-white/70 md:inline-flex"
                >
                  <X className="size-5" />
                </Button>
              </DialogClose>
              <div className="px-4 pb-10 pt-6 md:px-10 md:pb-12 md:pt-10">
                <Tabs.Content value="account" className="outline-none">
                  <AccountSection />
                </Tabs.Content>
                <Tabs.Content value="usage" className="outline-none">
                  <UsageSection />
                </Tabs.Content>
                <Tabs.Content value="key" className="outline-none">
                  <ApiKeySection />
                </Tabs.Content>
                <Tabs.Content value="reminders" className="outline-none">
                  <RemindersSection />
                </Tabs.Content>
                <Tabs.Content value="data" className="outline-none">
                  <DataSection />
                </Tabs.Content>
              </div>
            </div>
          </Tabs.Root>
          <DemoControls store={accountScenario} queryKey={accountKeys.all} className="absolute bottom-4 right-4 z-20" />
        </DialogContent>
      </Dialog>
    </SettingsContext.Provider>
  );
}
