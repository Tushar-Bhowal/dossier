"use client";

import * as React from "react";
import { LogOut, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { logout } from "@/lib/api";
import { toast } from "@/components/ui/toast";
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

export function AppSidebar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const [confirmSignOutOpen, setConfirmSignOutOpen] = React.useState(false);

  async function handleSignOut() {
    try {
      await logout();
      // Cancel any in-flight queries first, then remove the "me" cache entry
      // entirely (not set to undefined — that triggers a refetch cycle which
      // causes the dashboard layout to flicker between loading/error states).
      await queryClient.cancelQueries({ queryKey: ["me"] });
      queryClient.removeQueries({ queryKey: ["me"] });
      if (isMobile) {
        setOpenMobile(false);
      }
      toast.success("Signed out successfully.");
      // replace, not push — prevents back-button bouncing to the dashboard
      router.replace("/login");
    } catch (err) {
      toast.error("Sign out failed. Please try again.");
      throw err;
    }
  }

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
          href="/kits"
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
                  currentPath.startsWith("/runs/");
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
        <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <Avatar className="size-9 shrink-0 rounded-lg bg-[#dc3019]" title={userDisplayName}>
            <AvatarFallback className="rounded-lg bg-transparent text-[13px] font-bold text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-semibold capitalize text-white">{userDisplayName}</span>
            <span className="truncate text-xs text-white/55">{user?.email ?? ""}</span>
          </div>
          <Button
            onClick={() => setConfirmSignOutOpen(true)}
            title="Sign out"
            aria-label="Sign out"
            size="icon-sm"
            variant="ghost"
            className="shrink-0 text-white/55 hover:bg-destructive/10 hover:text-[#ff7a5c]"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
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
