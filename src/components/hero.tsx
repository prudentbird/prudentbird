import Image from "next/image";

export function Hero() {
  return (
    <section>
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-5 sm:gap-6">
          <div
            aria-hidden="true"
            className="shrink-0 -rotate-3 drop-shadow-md"
            style={{ width: 96, height: 96 }}
          >
            <div
              className="p-1.5 w-full h-full rounded-sm"
              style={{ background: "var(--text-gradient)" }}
            >
              <Image
                src="/pfp.png"
                alt=""
                width={84}
                height={84}
                priority
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-0 -mb-6">
            <h1
              className="text-4xl md:text-5xl font-medium tracking-tight"
              style={{
                background: "var(--text-gradient)",
                WebkitTextFillColor: "transparent",
                WebkitBackgroundClip: "text",
              }}
            >
              Prudent Bird.
            </h1>

            <nav
              aria-label="Links"
              className="flex items-center gap-4 flex-wrap"
            >
              {[
                { label: "Mail", href: "mailto:me@prudentbird.com" },
                {
                  label: "GitHub",
                  href: "https://github.com/prudentbird",
                  external: true,
                },
                {
                  label: "Twitter",
                  href: "https://x.com/prudentbird",
                  external: true,
                },
                { label: "Resume", href: "/cv.pdf", download: true },
              ].map(({ label, href, external, download }) => (
                <a
                  key={label}
                  href={href}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  {...(download ? { download: true } : {})}
                  className="text-sm text-muted-foreground/80 hover:text-foreground transition-colors duration-150 underline underline-offset-2"
                >
                  {label}
                  {external && (
                    <span className="sr-only"> (opens in new tab)</span>
                  )}
                </a>
              ))}
            </nav>
          </div>
        </div>

        <p className="text-lg text-muted-foreground leading-relaxed">
          Over the years, I&apos;ve taken ideas from simple concepts to
          functional products that users find genuinely useful in their day to
          day lives.
        </p>
      </div>
    </section>
  );
}
