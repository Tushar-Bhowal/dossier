import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, Facts, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy — Dossier",
  description: "What Dossier stores, who processes it, how long it's kept, and how to delete it.",
};

const link = "font-semibold text-[#ff7a5c] underline-offset-4 hover:underline";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="8 October 2026"
      intro={
        <p>
          The short version: what you put in Dossier is yours and only you can see it. We send text to AI services so they
          can do the work you asked for, we never sell anything, and you can delete everything at once.
        </p>
      }
      sections={[
        {
          id: "stored",
          title: "What we store",
          body: (
            <Facts
              items={[
                {
                  label: "Your account",
                  text: "Your email, and either your password (stored only as a one-way scrambled hash we can't read back) or your Google account ID if you sign in with Google.",
                },
                {
                  label: "Interview kits",
                  text: "The company, role and job description you enter, the kit we build from them, and your flashcard practice progress.",
                },
                {
                  label: "Applications",
                  text: "Everything you type into the job tracker, including notes and interview dates.",
                },
                {
                  label: "Chat with Dossier",
                  text: "Your messages and Dossier's replies, deleted automatically after 30 days. Files or text you paste in are read once and never stored, only their name.",
                },
                {
                  label: "Pasted recruiter emails",
                  text: "Only the suggested update we made from it, never the email itself. Deleted after 30 days.",
                },
                {
                  label: "Reminders",
                  text: "Your reminder settings, your Telegram chat ID if you connect Telegram, and your browser's notification address if you turn those on. A record of each reminder sent is kept for 30 days so you don't get it twice.",
                },
                {
                  label: "Connected AI assistants",
                  text: "Which assistant you connected and its access passes. These expire on their own: after 1 hour, or 30 days for the one that renews it.",
                },
                {
                  label: "Resume Studio",
                  text: "Not stored yet. Resume Studio currently runs on sample data. When it's connected, your resumes will be kept in your account like everything else. A PDF you upload is read in your browser and never sent to us.",
                },
              ]}
            />
          ),
        },
        {
          id: "processors",
          title: "Who else handles it",
          body: (
            <>
              <p>Dossier uses a few outside services to do its work. Each one gets only what that job needs.</p>
              <Facts
                items={[
                  {
                    label: "Google Gemini",
                    text: "Writes kits, answers chat and suggests edits. It receives the text needed for that request, such as a job description, or your chat message with a short summary of your tracked applications and recent chat so it knows what you mean. Dossier uses Gemini's free plan, and on that plan Google may use what it receives to improve its products. Please don't paste things you'd want kept private, like ID numbers.",
                  },
                  { label: "Groq", text: "A backup AI service, used when Gemini is busy. It receives the same kind of text." },
                  {
                    label: "Web search",
                    text: "To find public interview discussions we search for the company's name. Search services (Tavily, or DuckDuckGo and Reddit as a backup) see only that name, never your details.",
                  },
                  {
                    label: "Web pages you give us",
                    text: "When you add a company website or job link, Dossier visits that page to read it.",
                  },
                  {
                    label: "Telegram and your browser",
                    text: "If you turn on reminders, the reminder text goes through Telegram or your browser's notification service. Upstash, which schedules them, sees only internal IDs and times.",
                  },
                  {
                    label: "Hosting",
                    text: "The app runs on Vercel and your data is kept in a MongoDB Atlas database.",
                  },
                ]}
              />
            </>
          ),
        },
        {
          id: "never",
          title: "What we never do",
          body: (
            <Bullets
              items={[
                "Sell your data, or share it for advertising.",
                "Read your Gmail or any inbox. You paste an email in, or your own AI assistant reads it and suggests changes you approve.",
                "Sign in to LinkedIn or any other site as you.",
                "Show your data to other Dossier users.",
              ]}
            />
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              One cookie keeps you signed in, for up to 7 days. Your browser also remembers a few small choices, like which
              view you last used in Applications. There are no advertising or tracking cookies.
            </p>
          ),
        },
        {
          id: "delete",
          title: "Deleting your data",
          body: (
            <>
              <p>
                In{" "}
                <Link href="/home?settings=data" className={link}>
                  Settings
                </Link>
                , choose <strong className="font-semibold text-white">Delete my account</strong>. It removes your account
                and everything listed above in one go. Anything sent to an AI service follows that service&apos;s own rules
                after it was sent.
              </p>
              <p>You can also delete single kits, applications or chat history whenever you like.</p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to this page",
          body: (
            <p>
              If what we store or who handles it changes, this page changes first, with a new date at the top. See also the{" "}
              <Link href="/terms" className={link}>
                Terms
              </Link>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
