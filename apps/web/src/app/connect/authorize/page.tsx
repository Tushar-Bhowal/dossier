"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, LoaderCircle, X } from "lucide-react";
import { getOAuthClient } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { saveReturnTo } from "@/lib/returnTo";

const CAN = ["See your applications, interviews and notes", "Suggest updates, such as a new interview from an email"];
const CANNOT = [
  "Change or delete anything by itself: you apply every suggestion in Dossier",
  "See your resumes, interview kits, email or password",
];

function Consent() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: user, isError: signedOut, isLoading } = useMe();
  const clientId = params?.get("client_id") ?? "";
  const redirectUri = params?.get("redirect_uri") ?? "";
  const codeChallenge = params?.get("code_challenge") ?? "";
  const complete = Boolean(clientId && redirectUri && codeChallenge);

  const client = useQuery({
    queryKey: ["oauth-client", clientId],
    queryFn: () => getOAuthClient(clientId),
    enabled: complete && Boolean(user),
    retry: false,
  });

  // Signed out: remember this page, sign in, and the dashboard brings you straight back here.
  React.useEffect(() => {
    if (!signedOut) return;
    saveReturnTo(`${window.location.pathname}${window.location.search}`);
    router.replace("/login");
  }, [signedOut, router]);

  if (!complete) return <Message title="This link is incomplete" body="Start connecting again from your AI assistant." />;
  if (isLoading || signedOut || client.isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading">
        <LoaderCircle className="size-6 animate-spin text-white/50" />
      </div>
    );
  }
  if (client.isError || !client.data) {
    return <Message title="Unknown app" body="This app isn't registered with Dossier. Start connecting again from your AI assistant." />;
  }

  const hidden = { client_id: clientId, redirect_uri: redirectUri, code_challenge: codeChallenge, state: params?.get("state"), resource: params?.get("resource") };

  return (
    <form method="POST" action="/api/v1/oauth/consent" className="flex flex-col gap-6">
      {Object.entries(hidden).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
          {client.data.name} wants to use your Dossier tracker
        </h1>
        <p className="mt-2 text-[15px] font-medium text-white/60">Signed in as {user?.email}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
        <ul className="flex flex-col gap-2.5">
          {CAN.map((line) => (
            <li key={line} className="flex gap-2.5 text-[15px] font-medium text-white/85">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden /> {line}
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-2.5 border-t border-white/[0.08] pt-4">
          {CANNOT.map((line) => (
            <li key={line} className="flex gap-2.5 text-[15px] font-medium text-white/60">
              <X className="mt-0.5 size-4 shrink-0 text-white/40" aria-hidden /> {line}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm font-medium text-white/55">
        After you allow it, you&apos;ll go back to <span className="font-semibold text-white">{client.data.redirectHost}</span>. Only
        continue if that&apos;s the app you&apos;re connecting. You can disconnect it any time under AI assistants.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" name="decision" value="deny" variant="outline" size="lg">
          Cancel
        </Button>
        <Button type="submit" name="decision" value="allow" size="lg">
          Allow
        </Button>
      </div>
    </form>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 py-6">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">{title}</h1>
      <p className="text-[15px] font-medium text-white/60">{body}</p>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={30} height={30} priority className="size-[30px]" />
          <span className="text-lg font-semibold tracking-[-0.02em] text-white">Dossier</span>
        </div>
        <React.Suspense fallback={null}>
          <Consent />
        </React.Suspense>
      </div>
    </main>
  );
}
