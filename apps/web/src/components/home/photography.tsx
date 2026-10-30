import { MobilePhotos } from "~/components/hero/mobile-photos";
import { PhotoStackHero } from "~/components/hero";
import { SectionHeader } from "./section-header";

const container = "mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12";

export function Photography() {
  return (
    <section
      aria-labelledby="photography"
      className={`${container} scroll-mt-20 overflow-x-clip pb-16`}
    >
      <SectionHeader id="photography" title="Photography" />
      <div className="relative mt-10 grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="min-w-0 pr-14 lg:pr-0 lg:col-span-6">
          <p className="max-w-lg text-[clamp(2.25rem,4vw,3.5rem)] font-medium leading-[0.95] tracking-[-0.035em]">
            Freezing moments in time.
          </p>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-muted-foreground sm:text-2xl">
            Most of what I build is meant to change. Every release replaces the
            last. A photograph is the opposite. It holds a moment exactly as it
            was, long after the moment itself has gone. That&apos;s why I keep a
            camera close, and why these frames matter to me as much as anything
            I&apos;ve shipped.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            <span className="lg:hidden">Tap a photo to bring it forward.</span>
            <span className="hidden lg:inline">
              Hover to spread the photos out, then click one to bring it
              forward.
            </span>
          </p>
        </div>
        <MobilePhotos />
        <div className="hidden min-w-0 lg:block lg:col-span-6">
          <PhotoStackHero className="mx-auto aspect-square w-full max-w-[560px]" />
        </div>
      </div>
    </section>
  );
}
