import { Nav } from "@/components/landing/sections/Nav";
import { Hero } from "@/components/landing/sections/Hero";
import { Statement } from "@/components/landing/sections/Statement";
import { Pillars } from "@/components/landing/sections/Pillars";
import { HowItWorks } from "@/components/landing/sections/HowItWorks";
import { DeepDives } from "@/components/landing/sections/DeepDives";
import { Loop } from "@/components/landing/sections/Loop";
import { Principles } from "@/components/landing/sections/Principles";
import { Faq } from "@/components/landing/sections/Faq";
import { FinalCta } from "@/components/landing/sections/FinalCta";
import { Footer } from "@/components/landing/sections/Footer";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main id="top" className="w-full overflow-x-clip">
        <Hero />
        <Statement />
        <Pillars />
        <HowItWorks />
        <DeepDives />
        <Loop />
        <Principles />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
