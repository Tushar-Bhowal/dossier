"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Map, MessageSquareQuote, ScanSearch } from "lucide-react";
import { login, register, ApiError } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { LightRays } from "@/components/ui/light-rays";
import { NoiseTexture } from "@/components/ui/noise-texture";
import { Embers } from "@/components/landing/motion/Embers";
import { InterviewMock } from "@/components/landing/mocks/InterviewMock";
import { Accent } from "@/components/landing/SectionHeading";
import { primaryButtonClass, secondaryButtonClass } from "@/components/landing/Buttons";

const FEATURES = [
  { icon: Map, text: "Roadmaps for any role, researched from real hiring pages" },
  { icon: MessageSquareQuote, text: "Mock interviews graded on your own words" },
  { icon: ScanSearch, text: "Resumes tailored to the job, no fake ATS scores" },
];

const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled. Try again, or use your email and password.",
  google_unavailable: "Google sign-in isn't available right now. Use your email and password.",
  google_failed: "Google sign-in didn't work. Please try again.",
};

const inputClass =
  "h-12 w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-white/35 hover:border-white/20 focus:border-primary/60 focus:ring-3 focus:ring-primary/20";

function AuthContent() {
  const searchParams = useSearchParams();
  const paramMode = searchParams?.get("mode");
  const defaultIsLogin = paramMode !== "register";

  const [isLogin, setIsLogin] = useState(defaultIsLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(() => GOOGLE_ERRORS[searchParams?.get("error") ?? ""] ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [leavingForGoogle, setLeavingForGoogle] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading: isCheckingAuth } = useMe();

  // Redirect to /kits if already logged in
  useEffect(() => {
    if (!isCheckingAuth && user) {
      router.replace("/kits");
    }
  }, [user, isCheckingAuth, router]);

  // Coming back from Google with the browser's Back button restores this page from the back/forward
  // cache, spinner and all.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLeavingForGoogle(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Adjusted during render rather than from an effect: an effect would paint the previous tab
  // first and correct it on the next frame.
  const [lastMode, setLastMode] = useState(paramMode);
  if (paramMode !== lastMode) {
    setLastMode(paramMode);
    if (paramMode === "login") {
      setIsLogin(true);
    } else if (paramMode === "register") {
      setIsLogin(false);
    }
  }

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    if (!isLogin && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        const loggedInUser = await login(email, password);
        queryClient.setQueryData(["me"], loggedInUser);
        toast.success("Welcome back!", {
          description: `Signed in as ${loggedInUser.email}.`,
        });
        router.push("/kits");
      } else {
        const registeredUser = await register(email, password);
        queryClient.setQueryData(["me"], registeredUser);
        toast.success("Account created successfully!", {
          description: "Welcome to Dossier.",
        });
        router.push("/kits");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Authentication failed. Please try again.";
      setError(msg);
      toast.error("Authentication failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode(targetLogin: boolean) {
    setError(null);
    setIsLogin(targetLogin);
    window.history.replaceState(null, "", targetLogin ? "/login" : "/login?mode=register");
  }

  function handleGoogle() {
    setError(null);
    setLeavingForGoogle(true);
  }

  return (
    <div className="flex min-h-screen w-full bg-background lg:p-3">
      <section className="relative flex w-full flex-col overflow-hidden px-5 py-6 sm:px-10 lg:w-[46%] lg:py-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(255,96,48,0.22),transparent_75%)]" />
        </div>

        <div className="relative flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Image src="/logo.png" alt="" width={30} height={30} priority className="size-[30px]" />
            <span className="text-[17px] font-bold tracking-[-0.02em] text-white">Dossier</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-white/65 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to home
          </Link>
        </div>

        <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-white sm:text-[36px]">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-white/65">
            {isLogin
              ? "Sign in to pick up your prep where you left off."
              : "Free to start, no card needed. Your first kit is minutes away."}
          </p>

          <div
            role="group"
            aria-label="Choose sign in or sign up"
            className="mt-8 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1"
          >
            {[
              { label: "Sign in", login: true },
              { label: "Sign up", login: false },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-pressed={isLogin === tab.login}
                onClick={() => toggleMode(tab.login)}
                className={cn(
                  "h-10 rounded-lg text-[15px] font-semibold transition-colors",
                  isLogin === tab.login
                    ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-white/55 hover:text-white",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- an API route that redirects to Google; it needs a full page load, which <Link> would skip */}
          <a
            href="/api/v1/auth/google"
            onClick={handleGoogle}
            aria-disabled={leavingForGoogle}
            className={cn(
              secondaryButtonClass,
              "mt-6 h-12 w-full text-[15px]",
              leavingForGoogle && "pointer-events-none opacity-70",
            )}
          >
            {leavingForGoogle ? <LoaderCircle className="size-[18px] animate-spin" aria-hidden /> : <GoogleMark />}
            Continue with Google
          </a>

          <div className="my-6 flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[13px] font-medium text-white/45">or with email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-white/85">
                Email
              </label>
              <input
                id="email"
                className={inputClass}
                type="email"
                placeholder="name@work-email.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-white/85">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  className={cn(inputClass, "pr-12")}
                  type={showPassword ? "text" : "password"}
                  placeholder={isLogin ? "Your password" : "At least 8 characters"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={cn(primaryButtonClass, "mt-2 h-12 w-full text-base")}
            >
              {submitting && <LoaderCircle className="size-[18px] animate-spin" aria-hidden />}
              {submitting
                ? isLogin
                  ? "Signing in…"
                  : "Creating account…"
                : isLogin
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] leading-relaxed text-white/45">
            By continuing, you agree to Dossier&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>

      <BrandPanel />
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden rounded-lg border border-white/[0.08] bg-[#0d0d0d] p-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] lg:flex xl:p-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(255,96,48,0.28),transparent_75%)]" />
        <LightRays
          color="rgba(255, 96, 48, 0.24)"
          count={6}
          blur={40}
          speed={16}
          length="80%"
          className="[mask-image:linear-gradient(to_bottom,black_30%,transparent_80%)]"
        />
        <Embers className="absolute inset-0 size-full" count={40} />
        <NoiseTexture className="opacity-[0.15] mix-blend-overlay dark:opacity-[0.15]" frequency={0.7} />
      </div>

      <div className="relative max-w-lg">
        <h2 className="text-balance text-[40px] font-semibold leading-[1.06] tracking-[-0.04em] text-white xl:text-[48px]">
          Interview prep for any role, <Accent>researched</Accent> for you.
        </h2>
        <ul className="mt-8 space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3.5 text-base font-medium text-white/80">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-12 [perspective:1400px]">
        <div className="origin-bottom [transform:rotateX(8deg)]">
          <InterviewMock />
        </div>
      </div>
    </aside>
  );
}

// Google's four-colour "G", as their sign-in branding guidelines require.
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FBBC05"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#EA4335"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#4285F4"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-background" />}>
      <AuthContent />
    </Suspense>
  );
}
