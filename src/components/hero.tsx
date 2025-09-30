import { X } from "./ui/svgs/x";
import { Github } from "./ui/svgs/github";
import { FileInput, Mail } from "lucide-react";

export function Hero() {
  return (
    <section>
      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-6">
          <h1
            className="text-4xl md:text-5xl font-medium tracking-tight"
            style={{
              background: "var(--text-gradient)",
              WebkitTextFillColor: "transparent",
              WebkitBackgroundClip: "text",
            }}
          >
            Hello, I am Prudent Bird.
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed">
            Over the years, I&apos;ve taken ideas from simple concepts to
            functional products that users find genuinely useful in their day to
            day lives.
          </p>
          <p className="text-lg italic text-muted-foreground/80 leading-relaxed">
            &quot;When Life Sucks, Enjoy the Head!&quot;
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <a
            href="mailto:prudentbird@gmail.com"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-background hover:bg-muted/50 border border-border rounded-lg transition-colors text-sm"
          >
            <Mail className="size-4" />
            Mail
          </a>
          <a
            href="https://github.com/prudentbird"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-background hover:bg-muted/50 border border-border rounded-lg transition-colors text-sm"
          >
            <Github className="size-4 text-black dark:text-white" />
            GitHub
          </a>
          <a
            href="https://x.com/prudentbird"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-background hover:bg-muted/50 border border-border rounded-lg transition-colors text-sm"
          >
            <X className="size-4 text-black dark:text-white scale-[0.9]" />
            Twitter
          </a>
          <a
            href="/cv.pdf"
            download
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-background hover:bg-muted/50 border border-border rounded-lg transition-colors text-sm"
          >
            <FileInput className="size-4" />
            Resume
          </a>
        </div>
      </div>
    </section>
  );
}
