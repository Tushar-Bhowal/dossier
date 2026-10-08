"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, GripVertical, MousePointerClick, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BackLink } from "@/components/roadmap/RoadmapView";
import { cn } from "@/lib/utils";

type Browser = "chrome" | "safari" | "firefox" | "phone";

const BROWSERS: { id: Browser; label: string }[] = [
  { id: "chrome", label: "Chrome, Edge, Brave" },
  { id: "safari", label: "Safari" },
  { id: "firefox", label: "Firefox" },
  { id: "phone", label: "Phone" },
];

const STEPS: Record<Exclude<Browser, "phone">, string[]> = {
  chrome: [
    "Show your bookmarks bar: press Ctrl + Shift + B (⌘ + Shift + B on a Mac).",
    "Drag the “Add to Dossier” button above onto the bar.",
    "On any job page, click it. A small window opens with the job filled in.",
  ],
  safari: [
    "Show the favourites bar: View → Show Favourites Bar.",
    "Drag the “Add to Dossier” button above onto the bar.",
    "On any job page, click it. A small window opens with the job filled in.",
  ],
  firefox: [
    "Show the bookmarks toolbar: View → Toolbars → Bookmarks Toolbar.",
    "Drag the “Add to Dossier” button above onto the toolbar.",
    "On any job page, click it. A small window opens with the job filled in.",
  ],
};

const noSubscribe = () => () => {};

// The bookmark opens Dossier's add page with only the page's address, title and any selected text.
function bookmarkCode(origin: string): string {
  return `javascript:(()=>{const s=String(getSelection()).slice(0,4000);window.open('${origin}/add?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&text='+encodeURIComponent(s),'dossier','width=520,height=760')})()`;
}

const SAMPLE = new URLSearchParams({
  url: "https://www.linkedin.com/jobs/view/4012345678",
  title: "Razorpay hiring Frontend Engineer in Bengaluru, Karnataka, India | LinkedIn",
  text: "",
}).toString();

export function BookmarkInstall() {
  const [browser, setBrowser] = React.useState<Browser>("chrome");
  const origin = React.useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const linkRef = React.useRef<HTMLAnchorElement>(null);

  // React refuses javascript: links in JSX, so the bookmark's address is set on the element directly.
  React.useEffect(() => {
    if (origin) linkRef.current?.setAttribute("href", bookmarkCode(origin));
  }, [origin]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BackLink href="/applications">Applications</BackLink>
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">Save jobs from any site</h1>
        <p className="max-w-2xl text-base leading-relaxed text-white/60">
          Add one bookmark to your browser. On LinkedIn, Naukri, Indeed or a company&apos;s careers page, click it and the job lands in your
          tracker in two clicks.
        </p>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-lg border border-white/[0.08] bg-[#111111] bg-[radial-gradient(80%_70%_at_50%_0%,rgba(251,65,40,0.12),transparent_60%)] px-6 py-10 text-center">
        <a
          ref={linkRef}
          href="#"
          draggable
          onClick={(e) => {
            e.preventDefault();
            toast.info("Drag it to your bookmarks bar", { description: "Clicking it here does nothing; it works on job pages." });
          }}
          className="inline-flex h-12 cursor-grab items-center gap-2 rounded-lg bg-[#dc3019] px-5 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_30px_-10px_rgba(251,65,40,0.8)] active:cursor-grabbing"
        >
          <GripVertical className="size-4 opacity-70" aria-hidden />
          <Bookmark className="size-4" aria-hidden />
          Add to Dossier
        </a>
        <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
          <MousePointerClick className="size-4 text-[#ff7a5c]" aria-hidden />
          Drag this button to your bookmarks bar
        </p>
      </section>

      <section aria-labelledby="how-heading" className="flex flex-col gap-4">
        <h2 id="how-heading" className="text-lg font-semibold tracking-[-0.02em] text-white">
          How to add it
        </h2>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist" aria-label="Browser">
          {BROWSERS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={browser === b.id}
              onClick={() => setBrowser(b.id)}
              className={cn(
                "h-10 shrink-0 rounded-lg px-3.5 text-sm font-semibold transition-colors",
                browser === b.id ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
          {browser === "phone" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[15px] leading-relaxed text-white/80">
                Bookmarks like this are fiddly on phones. Instead, copy the job&apos;s link, then paste it into Add application; Dossier reads the
                page for you.
              </p>
              <Button asChild variant="outline" className="h-11 self-start">
                <Link href="/applications?new=1">
                  <Plus className="size-4" aria-hidden />
                  Add application
                </Link>
              </Button>
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {STEPS[browser].map((step, i) => (
                <li key={step} className="flex items-start gap-3 text-[15px] font-medium leading-relaxed text-white/80">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[13px] font-bold text-white/80">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-white">See what it does</p>
          <p className="mt-0.5 text-sm text-white/60">Opens the add window with a sample LinkedIn job, like clicking the bookmark there.</p>
        </div>
        <Button
          variant="outline"
          className="h-11 shrink-0"
          onClick={() => window.open(`/add?${SAMPLE}`, "dossier", "width=520,height=760")}
        >
          Try it
        </Button>
      </section>

      <p className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-sm leading-relaxed text-white/65">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
        The bookmark only runs when you click it, and only sends the page&apos;s address, its title and any text you&apos;ve selected. Nothing
        else on the page is read.
      </p>
    </div>
  );
}
