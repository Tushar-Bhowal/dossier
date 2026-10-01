import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { LightRays } from "@/components/ui/light-rays";
import { NoiseTexture } from "@/components/ui/noise-texture";
import { Accent, Container } from "../SectionHeading";
import { PrimaryButton, SecondaryButton } from "../Buttons";
import { Reveal } from "../motion/Reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-44">
      <Container className="relative">
        <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[#0d0d0d] px-6 py-20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-12 sm:py-28">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <LightRays color="rgba(251, 90, 40, 0.4)" count={7} blur={40} speed={15} length="120%" />
            <NoiseTexture className="opacity-[0.15] mix-blend-overlay dark:opacity-[0.15]" frequency={0.7} />
            <div className="absolute left-1/2 top-full size-[1400px] -translate-x-1/2 -translate-y-[38%] rounded-full border-t border-white/[0.16] shadow-[0_-1px_40px_rgba(251,65,40,0.3)]" />
          </div>
          <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-lg border border-white/10 bg-[#151515] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(251,65,40,0.6)]">
              <Image src="/logo.png" alt="" width={40} height={40} className="size-10" />
            </span>
            <h2 className="mt-8 text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.045em] text-white sm:text-[64px]">
              Your next interview is already <Accent>on the calendar</Accent>.
            </h2>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/70 sm:text-xl">
              Start with a company kit today. Roadmaps, mock interviews and Resume Studio arrive next.
            </p>
            <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <PrimaryButton href="/register" className="w-full sm:w-auto">
                Start free <ArrowUpRight className="size-[18px]" aria-hidden />
              </PrimaryButton>
              <SecondaryButton href="/login" className="w-full sm:w-auto">
                Sign in
              </SecondaryButton>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
