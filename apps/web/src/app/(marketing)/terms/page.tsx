import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms — Dossier",
  description: "The plain-English terms for using Dossier.",
};

const link = "font-semibold text-[#ff7a5c] underline-offset-4 hover:underline";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="8 October 2026"
      intro={<p>Dossier is a free tool for preparing for job interviews and keeping track of applications. By using it, you agree to these terms.</p>}
      sections={[
        {
          id: "yours",
          title: "Your content is yours",
          body: (
            <p>
              What you add to Dossier stays yours. You let us store it and send it to the services listed on the{" "}
              <Link href="/privacy" className={link}>
                Privacy page
              </Link>{" "}
              only to do what you ask.
            </p>
          ),
        },
        {
          id: "ai",
          title: "AI can be wrong",
          body: (
            <p>
              Kits, answers, resume suggestions and research are written by AI from public sources. They can be out of date
              or wrong. Check anything important before you rely on it, especially facts about a company or salary.
            </p>
          ),
        },
        {
          id: "use",
          title: "Using Dossier fairly",
          body: (
            <Bullets
              items={[
                "Use it for your own job search.",
                "Don't try to get around the daily limits, overload the service, or reach other people's data.",
                "Don't use it to send spam or to mislead employers about your experience.",
                "Keep your sign-in details to yourself. You're responsible for what happens in your account.",
              ]}
            />
          ),
        },
        {
          id: "free",
          title: "A free service, as it is",
          body: (
            <p>
              Dossier is free and provided as it is, without guarantees. Features, daily limits and availability can change,
              and the service can pause or end. If it ends, we&apos;ll give notice where we reasonably can so you can save
              what you need.
            </p>
          ),
        },
        {
          id: "leaving",
          title: "Leaving",
          body: (
            <p>
              You can stop at any time and delete your account in{" "}
              <Link href="/home?settings=data" className={link}>
                Settings
              </Link>
              . We may close accounts that break these terms.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes",
          body: <p>If these terms change, this page changes first, with a new date at the top.</p>,
        },
      ]}
    />
  );
}
