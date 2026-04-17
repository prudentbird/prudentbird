"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

type Project = {
  name: string;
  link: string;
  github: string;
  description: string;
};

const projects: Project[] = [
  {
    name: "Beakcrypt",
    link: "https://beakcrypt.com",
    github: "https://github.com/prudentbird/beakcrypt",
    description: "Encrypted environment variable management for teams.",
  },
  {
    name: "FuseIon",
    link: "https://fuseion.app",
    github: "https://github.com/prudentbird/fuseion",
    description: "The AI chat app for nerds.",
  },
  {
    name: "Retailytics",
    link: "https://retailytics.ajared.ng",
    github: "https://github.com/ajared/retailintelligence",
    description: "Retail store data for business analytics.",
  },
];

type Mode = "preview" | "source";

function formatHost(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

export function Projects() {
  const [mode, setMode] = useState<Mode>("preview");

  return (
    <section>
      <div className="mb-6 sm:mb-8 flex items-baseline justify-between gap-3 sm:gap-4">
        <h2 className="text-2xl md:text-3xl font-semibold">Projects</h2>
        <div
          role="radiogroup"
          aria-label="Project link target"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ToggleOption
            label="preview"
            active={mode === "preview"}
            onClick={() => setMode("preview")}
          />
          <span aria-hidden="true" className="text-muted-foreground/40">
            /
          </span>
          <ToggleOption
            label="source"
            active={mode === "source"}
            onClick={() => setMode("source")}
          />
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-border/50">
        {projects.map((project) => {
          const href = mode === "preview" ? project.link : project.github;
          return (
            <li key={project.name}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-1 py-4 sm:py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-lg text-foreground">
                      {project.name}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">
                      {formatHost(href)}
                    </span>
                  </div>
                  <ArrowUpRight
                    className="size-3.5 sm:size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-focus-visible:opacity-100"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {project.description}
                </p>
                <span className="sr-only">
                  {mode === "preview"
                    ? " (opens site in new tab)"
                    : " (opens source on GitHub in new tab)"}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ToggleOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-sm px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
