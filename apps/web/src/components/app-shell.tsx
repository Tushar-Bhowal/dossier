"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function AppHeader() {
  const pathname = usePathname() ?? "";
  const { isOpen } = useSidebar();

  let pageTitle = "Interview Kits";
  if (pathname === "/kits/new") {
    pageTitle = "New Kit";
  } else if (pathname.startsWith("/kits/") && pathname.endsWith("/edit")) {
    pageTitle = "Edit Kit";
  } else if (pathname.startsWith("/kits/")) {
    pageTitle = "Kit Details";
  }

  return (
    <header className="sticky top-0 z-20 flex h-(--app-header-height,3rem) shrink-0 items-center justify-between border-b border-border/50 bg-background/85 px-3 md:px-5 backdrop-blur-md transition-[width,height] ease-linear">
      <div className="flex items-center gap-2.5">
        <SidebarTrigger />
        {!isOpen && <div className="h-4 w-[1px] bg-border/60" />}
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <span className="hidden md:inline text-muted-foreground">Workspace</span>
          <span className="hidden md:inline text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">{pageTitle}</span>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      className={cn("[--app-wrapper-max-width:80rem]", "[--app-header-height:3rem]")}
    >
      <AppSidebar />
      <SidebarInset className="bg-background min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex w-full min-w-0 flex-1 flex-col p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
