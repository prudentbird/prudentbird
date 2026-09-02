import { ThemeToggle } from "~/components/theme-toggle";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground/80">
      <p>
        Made with love by{" "}
        <a
          href="https://prudentbird.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Prudent Bird
        </a>
        .
      </p>
      <ThemeToggle />
    </footer>
  );
}
