"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

function pageTitleFor(pathname: string): string {
  if (pathname === "/resumes") return "Resume Studio";
  if (pathname === "/resumes/new") return "New resume";
  if (pathname.startsWith("/resumes/") && pathname.endsWith("/tailor")) return "Tailor for a job";
  if (pathname.startsWith("/resumes/")) return "Resume";
  if (pathname.startsWith("/runs/")) return "Generating kit";
  if (pathname.endsWith("/practice")) return "Practice";
  if (pathname.startsWith("/kits/")) return "Kit";
  return "Interview kits";
}

function AppHeader() {
  const pathname = usePathname() ?? "";
  const { isOpen } = useSidebar();
  const pageTitle = pageTitleFor(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-(--app-header-height,4rem) shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/80 px-4 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        {!isOpen && <div className="h-5 w-px bg-white/10" />}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <span className="hidden font-medium text-white/50 md:inline">Workspace</span>
          <span className="hidden text-white/25 md:inline">/</span>
          <span className="font-semibold text-white">{pageTitle}</span>
        </nav>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="[--app-header-height:4rem]">
      <AppSidebar />
      <SidebarInset className="bg-background min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex w-full min-w-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
