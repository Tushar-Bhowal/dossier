"use client";

import * as React from "react";
import { LogOut, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { logout } from "@/lib/api";
import { navGroups } from "@/components/app-shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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

  async function handleSignOut() {
    await logout();
    queryClient.setQueryData(["me"], undefined);
    router.push("/?mode=login");
  }

  const userDisplayName = user?.email ? user.email.split("@")[0] : "Candidate";
  const userInitials = (userDisplayName || "DS").slice(0, 2).toUpperCase();

  return (
    <Sidebar
      className="*:data-[slot=sidebar-inner]:bg-sidebar border-r border-sidebar-border"
      collapsible="offcanvas"
      variant="sidebar"
    >
      <SidebarHeader className="h-(--app-header-height,3rem) flex flex-row items-center justify-between px-3 border-b border-sidebar-border/50">
        <Link
          href="/kits"
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
          className="flex items-center gap-2.5 min-w-0 hover:opacity-85 transition-opacity"
        >
          <span className="flex size-8 shrink-0 items-center justify-center">
            <Image
              src="/logo.png"
              alt="Dossier"
              width={32}
              height={32}
              className="size-7 object-contain"
              priority
            />
          </span>
          <span className="truncate font-heading font-semibold text-base tracking-tight">
            Dossier
          </span>
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

      <SidebarContent className="px-2 py-3">
        {navGroups.map((group, groupIndex) => (
          <SidebarGroup key={group.label ?? groupIndex} className="p-1">
            {group.label && (
              <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground px-2 mb-1">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu className="gap-1">
              {group.items.map((item) => {
                const isActive =
                  currentPath === item.path ||
                  (item.path !== "/kits" && currentPath.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={
                        isActive
                          ? "bg-sidebar-accent text-[#FB4128] font-medium"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
                      }
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

      <SidebarFooter className="p-2 border-t border-sidebar-border/50">
        <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-2 text-sidebar-foreground">
          <Avatar
            className="size-8 shrink-0 rounded-md bg-[#FB4128]/15 border border-[#FB4128]/30"
            title={userDisplayName}
          >
            <AvatarFallback className="rounded-md bg-transparent text-[#FB4128] text-xs font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate font-medium text-xs text-foreground capitalize">
              {userDisplayName}
            </span>
            <span className="truncate text-muted-foreground text-[11px]">
              {user?.email ?? ""}
            </span>
          </div>
          <Button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-[#FB4128] hover:bg-destructive/10 shrink-0"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
