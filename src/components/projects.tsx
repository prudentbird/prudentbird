import { Button } from "./ui/button";
import { Github } from "./ui/svgs/github";
import {
  Store,
  MessageCircle,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

type Project = {
  name: string;
  icon: LucideIcon;
  link: string;
  github: string;
  description: string;
};

const projects: Project[] = [
  {
    name: "FuseIon",
    icon: MessageCircle,
    link: "https://fuseion.app",
    description: "The AI chat app for nerds.",
    github: "https://github.com/prudentbird/fuseion",
  },
  {
    name: "Retailytics",
    icon: Store,
    link: "https://retailintelligence.ajared.ng",
    github: "https://github.com/ajared/retailintelligence",
    description: "Retail store data for business analytics.",
  },
];

export function Projects() {
  return (
    <section>
      <h2 className="mb-8 text-2xl font-semibold">Projects</h2>
      <div className="flex flex-col gap-4">
        {projects.map((project) => (
          <article
            key={project.name}
            className="group relative cursor-pointer flex items-start gap-2 sm:gap-4 rounded-lg border border-border p-4 sm:p-6 transition-colors hover:border-muted-foreground/30"
          >
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <project.icon className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
            </div>
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${project.name}`}
              className="absolute inset-0 z-10"
            />
            <div className="flex flex-1 min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col justify-between h-full">
                <h3 className="font-semibold text-foreground">
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {project.name}
                  </a>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {project.description}
                </p>
              </div>
              <div className="relative z-20 flex w-full gap-2 sm:w-auto sm:gap-3 sm:justify-end">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full flex-1 sm:w-auto sm:flex-none"
                >
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit ${project.name}`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="hidden sm:block">Visit</span>
                  </a>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full flex-1 sm:w-auto sm:flex-none"
                >
                  <a
                    href={project.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${project.name} on GitHub`}
                  >
                    <Github className="h-4 w-4" />
                    <span className="hidden sm:block">GitHub</span>
                  </a>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
