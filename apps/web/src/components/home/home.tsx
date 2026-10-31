import { ArrowUpRight } from "lucide-react";
import { ThemeSwitcher } from "~/components/theme-switcher";
import { NEW_TAB_HINT_ID, externalProps, links, profile } from "~/lib/content";
import { VoxelAvatarHero } from "~/components/hero";
import { DESKTOP, MOBILE, OnMedia } from "~/components/on-media";
import { Artifacts } from "~/components/work/artifacts";
import { CopyButton } from "./copy-button";
import { Photography } from "./photography";
import { SectionHeader } from "./section-header";
import { SongVisualizer } from "./song-visualizer";

const container = "mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12";

export function Home() {
  return (
    <div id="top" className="min-h-screen overflow-x-clip">
      <span id={NEW_TAB_HINT_ID} className="sr-only">
        Opens in a new tab
      </span>
      <main>
        <section
          className={`${container} relative pt-14 pb-16 sm:pt-20 lg:pt-32`}
        >
          <div className="relative">
            <div className="absolute top-1/2 right-0 hidden aspect-square w-5/12 -translate-y-1/2 lg:block">
              <OnMedia query={DESKTOP}>
                <VoxelAvatarHero className="size-full" />
              </OnMedia>
            </div>
            <div className="flex items-center gap-[0.15em] max-[440px]:justify-between text-[clamp(3.5rem,12vw,11rem)] lg:block lg:text-[min(10vw,9rem)]">
              <h1
                className="relative z-10 font-medium leading-[0.88] tracking-[-0.045em] max-[440px]:w-min"
                style={{
                  background: "var(--text-gradient)",
                  WebkitTextFillColor: "transparent",
                  WebkitBackgroundClip: "text",
                }}
              >
                Prudent Bird
              </h1>
              <div className="relative h-[0.88em] w-[1.4em] shrink-0 max-[440px]:h-[1.76em] max-[440px]:w-[1.9em] max-[319px]:hidden lg:hidden">
                <div className="absolute top-1/2 left-0 size-[1.4em] -translate-y-1/2 max-[440px]:size-[1.9em]">
                  <OnMedia query={MOBILE}>
                    <VoxelAvatarHero className="size-full" />
                  </OnMedia>
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-10 sm:mt-8 lg:mt-12 lg:grid-cols-12">
              <p className="relative z-10 max-w-4xl text-xl leading-relaxed text-muted-foreground sm:text-3xl sm:leading-snug lg:col-span-7">
                <span className="text-foreground">{profile.role}.</span>{" "}
                {profile.bio} I currently work with{" "}
                <a
                  href={profile.employerUrl}
                  {...externalProps}
                  className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  Ajared
                </a>{" "}
                across infrastructure, backend, frontend and AI.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="work"
          className={`${container} scroll-mt-20 pt-16 pb-16`}
        >
          <SectionHeader id="work" title="Work" />
          <div className="mt-10">
            <Artifacts className="[&>li:first-child]:border-t-0" />
          </div>
        </section>

        <section
          aria-labelledby="about"
          className={`${container} scroll-mt-20 pt-16 pb-16`}
        >
          <SectionHeader id="about" title="About" />
          <p className="mt-6 text-xl leading-relaxed text-muted-foreground sm:text-2xl">
            I&apos;m {profile.realName}, known online as Prudent Bird. I&apos;ve
            been coding since 2019, and professionally since 2023. I recently
            got into photography, and I play{" "}
            <span
              className="group relative inline-block underline decoration-dotted underline-offset-4 focus-visible:outline-2"
              tabIndex={0}
              aria-describedby="about-games"
            >
              games
              <span
                id="about-games"
                role="tooltip"
                className="invisible absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-border/60 bg-popover p-3 text-left font-normal leading-snug text-popover-foreground opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
              >
                I&apos;m not much of a football fan; I prefer Sudoku,
                Alto&apos;s Adventure, Alto&apos;s Odyssey, and Call of Duty:
                Mobile.
              </span>
            </span>{" "}
            to unwind after work. I often ask myself:{" "}
            <em>&ldquo;What makes life worth living?&rdquo;</em>
            {"  "}For me, it comes down to chasing your greatest passion,
            finding joy even when everything seems difficult, keeping
            perspective, being patient with the unknown, and making progress at
            a steady pace.
          </p>
        </section>

        <Photography />

        <section
          aria-labelledby="listening"
          className={`${container} scroll-mt-20 pt-16 pb-16`}
        >
          <SectionHeader id="listening" title="Listening" />
          <div className="pt-10">
            <SongVisualizer />
          </div>
        </section>
      </main>

      <footer
        aria-labelledby="contact"
        className="border-t border-border/70 bg-muted/30"
      >
        <div className={`${container} pt-12 pb-16 sm:pt-20`}>
          <h2
            id="contact"
            className="scroll-mt-24 text-sm tracking-tight text-[#c2410c] sm:text-xl lg:text-2xl dark:text-[#fb923c]"
          >
            Got an idea? Tell me about it.
          </h2>
          <div className="mt-2 min-w-0 [container-type:inline-size] lg:mt-1">
            <div className="relative inline-block max-w-full text-[clamp(1.5rem,calc(10.2cqw-4px),9rem)]">
              <a
                href={`mailto:${profile.email}`}
                className="block min-w-0 whitespace-nowrap rounded-[0.08em] pb-[0.08em] font-medium leading-[0.9] tracking-[-0.04em] decoration-[#c2410c] decoration-[max(2px,0.03em)] outline-offset-[0.06em] hover:underline focus-visible:underline focus-visible:outline-none dark:decoration-[#fb923c]"
                style={{
                  background: "var(--text-gradient)",
                  WebkitTextFillColor: "transparent",
                  WebkitBackgroundClip: "text",
                }}
              >
                {profile.email}
              </a>
              <CopyButton
                value={profile.email}
                label="Copy email address"
                className="absolute top-[0.12em] left-full ml-[0.08em] size-[max(1.75rem,0.32em)] border-border/70 bg-background/60 text-muted-foreground backdrop-blur [&_svg]:size-[max(0.875rem,0.14em)]"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-10 gap-y-6">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 sm:gap-x-8">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    {...externalProps}
                    className="inline-flex h-10 items-center gap-1.5 text-[clamp(0.875rem,4.1vw,1rem)] underline-offset-4 hover:underline sm:text-lg"
                  >
                    {l.label}
                    <ArrowUpRight
                      className="size-4 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex w-full items-center justify-between gap-4 text-sm text-muted-foreground lg:w-auto lg:gap-6">
              <p className="min-w-0 leading-relaxed">
                © PrudentBird Services{" "}
                <span className="whitespace-nowrap">
                  · {profile.business.label}
                </span>
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
