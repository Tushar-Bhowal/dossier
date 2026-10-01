import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { manrope } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dossier — Interview prep for any role, researched for you",
  description:
    "Dossier studies how real companies hire, then turns it into a roadmap, practice questions, a graded mock interview and a resume that fits the job.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
