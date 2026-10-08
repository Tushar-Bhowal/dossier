"use client";

import * as React from "react";
import { BellRing, ChevronsUpDown, Gauge, LogOut, Plus, Settings, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { useSignOut } from "@/hooks/use-sign-out";
import { useOpenSettings, type SettingsTab } from "@/components/settings/SettingsDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { navGroups } from "@/components/app-shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItemClass =
  "flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-[15px] font-medium text-white/85 outline-none transition-colors data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-white";

function MenuItem({ icon: Icon, label, onSelect }: { icon: LucideIcon; label: string; onSelect: () => void }) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className={menuItemClass}>
      <Icon className="size-[18px] text-white/60" aria-hidden />
      {label}
    </DropdownMenu.Item>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const { data: user } = useMe();
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const [confirmSignOutOpen, setConfirmSignOutOpen] = React.useState(false);
  const openSettings = useOpenSettings();

  function showSettings(tab: SettingsTab) {
    if (isMobile) setOpenMobile(false);
    openSettings?.(tab);
  }

  const handleSignOut = useSignOut(() => {
    if (isMobile) setOpenMobile(false);
  });

  const userDisplayName = user?.email ? user.email.split("@")[0] : "Candidate";
  const userInitials = (userDisplayName || "DS").slice(0, 2).toUpperCase();

  return (
    <Sidebar
      className="*:data-[slot=sidebar-inner]:bg-sidebar border-r border-sidebar-border"
      collapsible="offcanvas"
      variant="sidebar"
    >
      <SidebarHeader className="flex h-(--app-header-height,4rem) flex-row items-center justify-between px-4">
        <Link
          href="/home"
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
          className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-85"
        >
          <Image
            src="/logo.png"
            alt="Dossier"
            width={30}
            height={30}
            className="size-[30px] object-contain"
            priority
          />
          <span className="truncate text-[17px] font-bold tracking-[-0.02em]">Dossier</span>
        </Link>
        <Button
          onClick={toggleSidebar}
          aria-label="Close sidebar"
          title="Close sidebar"
          size="icon-sm"
          variant="ghost"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </Button>
      </SidebarHeader>

      <div className="px-4 pb-2">
        <Button asChild className="h-10 w-full justify-center text-[15px]">
          <Link
            href="/kits?new=true"
            onClick={() => {
              if (isMobile) setOpenMobile(false);
            }}
          >
            <Plus className="size-4" aria-hidden /> New kit
          </Link>
        </Button>
      </div>

      <SidebarContent className="px-3 py-2">
        {navGroups.map((group, groupIndex) => (
          <SidebarGroup key={group.label ?? groupIndex} className="p-1">
            {group.label && (
              <SidebarGroupLabel className="mb-1 px-2 text-xs font-semibold uppercase tracking-[0.1em] text-white/40">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu className="gap-1">
              {group.items.map((item) => {
                if (item.soon) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <div
                        aria-disabled="true"
                        className="flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-white/40"
                      >
                        {item.icon}
                        <span className="flex-1 truncate">{item.title}</span>
                        <span className="rounded-lg bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-white/50">
                          Soon
                        </span>
                      </div>
                    </SidebarMenuItem>
                  );
                }
                const isActive =
                  currentPath === item.path ||
                  currentPath.startsWith(`${item.path}/`) ||
                  (item.path === "/kits" && currentPath.startsWith("/runs/"));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "h-10 gap-3 rounded-lg px-3 text-[15px] font-medium [&>svg]:size-[18px]",
                        isActive
                          ? "bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] data-[active=true]:bg-white/[0.07] [&>svg]:text-[#ff7a5c]"
                          : "text-white/65 hover:text-white",
                      )}
                    >
                      <Link
                        href={item.path}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-white/[0.06]"
            >
              <Avatar className="size-9 shrink-0 rounded-lg bg-[#dc3019]">
                <AvatarFallback className="rounded-lg bg-transparent text-[13px] font-bold text-white">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-semibold capitalize text-white">{userDisplayName}</span>
                <span className="truncate text-xs font-medium text-white/55">{user?.email ?? ""}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-white/50" aria-hidden />
              <span className="sr-only">Account menu</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="start"
              sideOffset={8}
              className="z-50 w-(--radix-dropdown-menu-trigger-width) min-w-[232px] rounded-lg border border-white/10 bg-[#141414] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
              <DropdownMenu.Label className="truncate px-3 pb-2 pt-1.5 text-sm font-medium text-white/55">
                {user?.email ?? ""}
              </DropdownMenu.Label>
              <MenuItem icon={Settings} label="Settings" onSelect={() => showSettings("account")} />
              <MenuItem icon={Gauge} label="Usage" onSelect={() => showSettings("usage")} />
              <MenuItem icon={BellRing} label="Reminders" onSelect={() => showSettings("reminders")} />
              <DropdownMenu.Separator className="my-1.5 h-px bg-white/[0.08]" />
              <DropdownMenu.Item asChild className={menuItemClass}>
                <Link href="/privacy">
                  <ShieldCheck className="size-[18px] text-white/60" aria-hidden />
                  Privacy and terms
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1.5 h-px bg-white/[0.08]" />
              <MenuItem icon={LogOut} label="Sign out" onSelect={() => setConfirmSignOutOpen(true)} />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </SidebarFooter>

      <ConfirmDialog
        open={confirmSignOutOpen}
        onOpenChange={setConfirmSignOutOpen}
        title="Sign out of Dossier?"
        description="Are you sure you want to sign out? You will need to log back in to access your interview kits and progress."
        confirmLabel="Sign out"
        confirmingLabel="Signing out…"
        cancelLabel="Cancel"
        variant="destructive"
        icon={<LogOut className="size-4" />}
        onConfirm={handleSignOut}
      />
    </Sidebar>
  );
}
