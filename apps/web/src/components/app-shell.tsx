"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AssistantProvider } from "@/components/assistant/AssistantPanel";
import { SettingsProvider } from "@/components/settings/SettingsDialog";
import { cn } from "@/lib/utils";

function pageTitleFor(pathname: string): string {
  if (pathname === "/home") return "Home";
  if (pathname === "/applications") return "Applications";
  if (pathname === "/assistants") return "AI assistants";
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

// The resume editor needs the full width for the form and the preview side by side, so the sidebar
// folds away on the way in and comes back on the way out if it was open before.
function CollapseSidebarOnResume() {
  const pathname = usePathname() ?? "";
  const { open, setOpen, isMobile } = useSidebar();
  const onResume = /^\/resumes\/(?!new$)[^/]+$/.test(pathname);
  const wasOnResume = React.useRef(false);
  const reopen = React.useRef(false);

  React.useEffect(() => {
    if (onResume === wasOnResume.current) return;
    wasOnResume.current = onResume;
    if (isMobile) return;
    if (onResume) {
      reopen.current = open;
      if (open) setOpen(false);
    } else if (reopen.current) {
      reopen.current = false;
      setOpen(true);
    }
  }, [onResume, isMobile, open, setOpen]);

  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // Room at the bottom so the floating "Ask Dossier" button never covers the last thing on a page.
  const onHome = usePathname() === "/home";
  return (
    <SidebarProvider className="[--app-header-height:4rem]">
      <SettingsProvider>
        <CollapseSidebarOnResume />
        <AppSidebar />
        <AssistantProvider>
          <SidebarInset className="bg-background min-h-screen flex flex-col">
            <AppHeader />
            <main className={cn("flex w-full min-w-0 flex-1 flex-col px-4 pt-6 md:px-8 md:pt-10", onHome ? "pb-6 md:pb-10" : "pb-24 md:pb-28")}>
              {children}
            </main>
          </SidebarInset>
        </AssistantProvider>
      </SettingsProvider>
    </SidebarProvider>
  );
}
