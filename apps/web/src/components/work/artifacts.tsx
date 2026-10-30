"use client";

import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { externalProps } from "~/lib/content";
import { RetailyticsState } from "./retailytics-state";
import { work } from "~/components/home/work";

function useLoop(
  active: boolean,
  ms: number,
  step: () => number | void,
  first = ms,
) {
  const latest = useRef(step);
  useEffect(() => {
    latest.current = step;
  });
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = (delay: number) => {
      timer = setTimeout(() => tick(latest.current() ?? ms), delay);
    };
    tick(first);
    return () => clearTimeout(timer);
  }, [active, ms, first]);
}

const DOC_PASSAGES = [
  { prefix: "# ", versions: ["Hello World", "Hello There"] },
  {
    prefix: "",
    versions: ["Our blog lives in the repo.", "Every post starts with a PR."],
  },
  {
    prefix: "- ",
    versions: ["Writing beside the code", "Review before publishing"],
  },
  {
    prefix: "- ",
    versions: ["Publish when you merge", "Ship posts like code"],
  },
  {
    prefix: "- ",
    versions: ["RSS and sitemap included", "Social previews built in"],
  },
] as const;

function parseDoc(text: string) {
  const lines = text.split("\n");
  const tags = /tags:\s*\[([^\]]*)\]?/.exec(text)?.[1];
  const end = lines.indexOf("---", 1);
  const body = end > 0 ? lines.slice(end + 1) : [];
  return {
    tags: tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    body,
  };
}

function VoxxArtifact({ active }: { active: boolean }) {
  const [edit, setEdit] = useState({
    versions: DOC_PASSAGES.map(() => 0),
    passage: 2,
    n: DOC_PASSAGES[2].versions[0].length,
    deleting: true,
  });
  useLoop(
    active,
    65,
    () => {
      const passage = DOC_PASSAGES[edit.passage]!;
      const current = passage.versions[edit.versions[edit.passage]!]!;
      if (edit.deleting) {
        if (edit.n > 0) {
          setEdit({ ...edit, n: edit.n - 1 });
          return 35;
        }
        const versions = [...edit.versions];
        versions[edit.passage] = 1 - versions[edit.passage]!;
        setEdit({ ...edit, versions, deleting: false });
        return 400;
      }
      if (edit.n < current.length) {
        setEdit({ ...edit, n: edit.n + 1 });
        return;
      }
      const next =
        (edit.passage +
          1 +
          Math.floor(Math.random() * (DOC_PASSAGES.length - 1))) %
        DOC_PASSAGES.length;
      const nextText = DOC_PASSAGES[next]!.versions[edit.versions[next]!]!;
      setEdit({ ...edit, passage: next, n: nextText.length, deleting: true });
      return 2600;
    },
    2600,
  );
  const passages = DOC_PASSAGES.map((passage, i) => {
    const full = passage.versions[edit.versions[i]!]!;
    return passage.prefix + (i === edit.passage ? full.slice(0, edit.n) : full);
  });
  const lines = [
    "---",
    `title: ${DOC_PASSAGES[0].versions[edit.versions[0]!]}`,
    "tags: [meta, shipping]",
    "---",
    "",
    passages[0]!,
    "",
    passages[1]!,
    "",
    "## Why",
    ...passages.slice(2),
  ];
  const cursorLine = [5, 7, 10, 11, 12][edit.passage];
  const text = lines.join("\n");
  const { tags, body } = parseDoc(text);
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-y-4 left-0 flex w-[56%] flex-col overflow-hidden rounded-xl bg-[#1b1a18] text-[#d6d3cc] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]">
        <p className="border-b border-white/10 px-3 py-2 font-mono sm:px-4 text-[11px] text-white/40">
          content/posts/hello-there.md
        </p>
        <pre className="min-h-0 flex-1 overflow-hidden py-2 pr-[14%] pl-3 font-mono sm:py-3 sm:pl-4 text-[10px] leading-[1.6] whitespace-pre-wrap sm:text-[11px]">
          {text.split("\n").map((line, i) => (
            <span
              key={i}
              className={cn(
                "block",
                line || i === cursorLine ? "min-h-[1.6em]" : "h-[0.8em]",
                /^#/.test(line) && "text-[#f97316]",
                /^(---|title:|tags:)/.test(line) && "text-white/45",
                /^- /.test(line) && "text-[#a3e635]/90",
              )}
            >
              {active && i === cursorLine ? (
                <>
                  {line.slice(0, -1)}
                  <span className="relative whitespace-nowrap">
                    {line.slice(-1)}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 left-full h-[1.2em] w-[0.6em] bg-white/80 [animation:voxx-cursor-blink_1s_step-end_infinite]"
                    />
                  </span>
                </>
              ) : (
                line
              )}
            </span>
          ))}
        </pre>
      </div>
      <div className="absolute top-12 right-0 bottom-0 w-[50%] overflow-hidden rounded-xl border border-border/60 bg-card p-3 sm:p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]">
        <div className="mb-3 flex min-h-5 gap-1.5">
          {tags.map((tag) => (
            <motion.span
              key={tag}
              initial={active ? { opacity: 0, y: 4 } : false}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-full bg-[#f97316]/12 px-2 py-0.5 text-[10px] text-[#c2410c] dark:text-[#fb923c]"
            >
              {tag}
            </motion.span>
          ))}
        </div>
        {body.map((line, i) => {
          if (line.startsWith("## "))
            return (
              <p key={i} className="mt-3 text-base font-semibold">
                {line.slice(3)}
              </p>
            );
          if (line.startsWith("# "))
            return (
              <p
                key={i}
                className="text-2xl leading-tight font-semibold tracking-tight"
              >
                {line.slice(2)}
              </p>
            );
          if (line.startsWith("- "))
            return (
              <p
                key={i}
                className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <span aria-hidden="true">•</span>
                {line.slice(2)}
              </p>
            );
          if (line.trim())
            return (
              <p
                key={i}
                className="mt-2 text-xs leading-relaxed text-muted-foreground"
              >
                {line}
              </p>
            );
          return null;
        })}
      </div>
    </div>
  );
}

const COMMAND = "npx beakcrypt pull --env production";
const STEPS = [
  { mark: "→", colour: "#5eead4", text: "Connecting to vault..." },
  { mark: "→", colour: "#5eead4", text: "Fetching encrypted bundle..." },
  { mark: "→", colour: "#5eead4", text: "Decrypting with local key..." },
  { mark: "✓", colour: "#22c55e", text: "Written 18 variables to .env.local" },
];
function BeakcryptArtifact({ active }: { active: boolean }) {
  const total = COMMAND.length + STEPS.length + 1;
  const [t, setT] = useState(total);
  useLoop(
    active,
    45,
    () => {
      if (t >= total) {
        setT(0);
        return 3200;
      }
      setT((v) => v + 1);
      if (t >= COMMAND.length) return 650;
    },
    3200,
  );
  const typed = COMMAND.slice(0, Math.min(t, COMMAND.length));
  const shown = Math.max(0, t - COMMAND.length);
  return (
    <div className="mx-auto flex h-full w-full max-w-100 items-center">
      <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0f] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f56]" />
          <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="size-2.5 rounded-full bg-[#27c93f]" />
          <span className="ml-2 text-xs text-white/30">terminal</span>
        </div>
        <div className="min-h-56 p-5 font-mono text-xs leading-relaxed sm:text-[13px]">
          <p className="text-white/60">
            <span className="text-[#5eead4]">$</span> {typed}
            {t < COMMAND.length && (
              <span className="ml-px inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-white/70" />
            )}
          </p>
          <div className="mt-4 space-y-1.5 text-white/50">
            {STEPS.slice(0, shown).map((step) => (
              <motion.p
                key={step.text}
                initial={active ? { opacity: 0, y: 4 } : false}
                animate={{ opacity: 1, y: 0 }}
              >
                <span style={{ color: step.colour }}>{step.mark}</span>{" "}
                {step.text}
              </motion.p>
            ))}
          </div>
          {shown > STEPS.length && (
            <motion.p
              initial={active ? { opacity: 0, y: 4 } : false}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded border border-[#22c55e]/20 bg-[#22c55e]/5 p-3"
            >
              <span className="text-[#22c55e]">Success!</span>
              <span className="text-white/50"> Environment synced in 1.2s</span>
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const GIVEN = new Set(
  Array.from({ length: 81 }, (_, i) => i).filter((i) => (i * 37 + 11) % 5 < 2),
);
const OPEN = Array.from({ length: 81 }, (_, i) => i)
  .filter((i) => !GIVEN.has(i))
  .sort((a, b) => ((a * 53) % 81) - ((b * 53) % 81));
function SudokuArtifact({ active }: { active: boolean }) {
  const [filled, setFilled] = useState(OPEN.length);
  useLoop(active, 260, () => {
    setFilled((v) => (v >= OPEN.length ? 0 : v + 1));
    return filled >= OPEN.length ? 1600 : undefined;
  });
  const done = new Set(OPEN.slice(0, filled));
  const you = OPEN[filled];
  const friend = OPEN[filled + 1];
  return (
    <div className="grid h-full place-items-center">
      <div className="grid aspect-square h-full grid-cols-9 overflow-hidden rounded-md border border-foreground/30">
        {Array.from({ length: 81 }, (_, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const shown = GIVEN.has(i) || done.has(i);
          return (
            <div
              key={i}
              className={cn(
                "relative grid place-items-center border-foreground/10 text-[10px] tabular-nums sm:text-xs",
                c % 3 === 2 && c < 8
                  ? "border-r border-r-foreground/30"
                  : "border-r",
                r % 3 === 2 && r < 8
                  ? "border-b border-b-foreground/30"
                  : "border-b",
                GIVEN.has(i)
                  ? "font-semibold"
                  : "text-[#2563eb] dark:text-[#60a5fa]",
                i === you && "bg-[#2563eb]/15 ring-1 ring-inset ring-[#2563eb]",
                i === friend &&
                  "bg-[#f97316]/15 ring-1 ring-inset ring-[#f97316]",
              )}
            >
              {shown && (
                <motion.span
                  initial={
                    !active || GIVEN.has(i) ? false : { scale: 0.2, opacity: 0 }
                  }
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                >
                  {SOLUTION[i]}
                </motion.span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CHAT = [
  { from: "you", text: "What's a monad, briefly?" },
  {
    from: "model",
    text: "A value in a context, plus a way to chain steps without leaving that context.",
  },
  { from: "you", text: "Now like I'm five." },
  {
    from: "model",
    text: "It's a lunchbox. You can't eat through the lid, but you can pass it along and the next person opens it for you.",
  },
] as const;
function FuseIonArtifact({ active }: { active: boolean }) {
  const [message, setMessage] = useState<number>(CHAT.length);
  const [words, setWords] = useState(0);
  useLoop(
    active,
    150,
    () => {
      if (message >= CHAT.length) {
        setMessage(0);
        setWords(0);
        return 900;
      }
      const current: (typeof CHAT)[number] = CHAT[message]!;
      const length = current.text.split(" ").length;
      if (words >= length) {
        setMessage((m) => m + 1);
        setWords(0);
        return message === CHAT.length - 1
          ? 3200
          : current.from === "you"
            ? 1000
            : 1500;
      }
      setWords((w) => w + 1);
    },
    3200,
  );
  return (
    <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center gap-3 text-sm leading-relaxed">
      {CHAT.map((m, i) => {
        const all = m.text.split(" ");
        const count = i < message ? all.length : i === message ? words : 0;
        const typed = (
          <>
            <span className="invisible">{m.text}</span>
            <span className="absolute inset-0 px-4 py-2">
              {all.slice(0, count).join(" ")}
            </span>
          </>
        );
        if (m.from === "you")
          return (
            <p
              key={i}
              className="relative ml-auto max-w-[70%] rounded-2xl rounded-br-md bg-foreground px-4 py-2 text-background"
            >
              {typed}
            </p>
          );
        return (
          <div key={i} className="flex max-w-[85%] gap-2.5">
            <p className="relative rounded-2xl rounded-tl-md bg-zinc-200 px-4 py-2 text-zinc-950 ring-1 ring-inset ring-zinc-300 dark:bg-muted dark:text-foreground dark:ring-white/10">
              {typed}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const NODES = [
  [50, 8],
  [28, 32],
  [72, 32],
  [16, 56],
  [40, 56],
  [60, 56],
  [84, 56],
  [10, 84],
  [22, 84],
  [34, 84],
  [46, 84],
  [54, 84],
  [66, 84],
  [78, 84],
  [90, 84],
] as const;
const EDGES = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [2, 6],
  [3, 7],
  [3, 8],
  [4, 9],
  [4, 10],
  [5, 11],
  [5, 12],
  [6, 13],
  [6, 14],
] as const;
function FamilyTreeArtifact({ active }: { active: boolean }) {
  const [gen, setGen] = useState(4);
  useLoop(active, 700, () => {
    setGen((g) => (g >= 5 ? 0 : g + 1));
  });
  const depth = (i: number) => (i === 0 ? 0 : i < 3 ? 1 : i < 7 ? 2 : 3);
  return (
    <svg viewBox="0 0 100 96" className="h-full w-full">
      {EDGES.map(([a, b]) => {
        const [x1, y1] = NODES[a]!;
        const [x2, y2] = NODES[b]!;
        const mid = (y1 + y2) / 2;
        return (
          <motion.path
            key={`${a}-${b}`}
            d={`M${x1} ${y1} C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`}
            fill="none"
            className="stroke-foreground/35"
            strokeWidth={0.7}
            initial={false}
            animate={{ pathLength: depth(b) <= gen ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          />
        );
      })}
      {NODES.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={i === 0 ? 3.4 : 2.6}
          className={
            i === 0 ? "fill-foreground" : "fill-background stroke-foreground"
          }
          strokeWidth={0.8}
          initial={false}
          animate={{ scale: depth(i) <= gen ? 1 : 0 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 18,
            delay: depth(i) <= gen ? 0.3 : 0,
          }}
        />
      ))}
    </svg>
  );
}

const ARTIFACTS: Record<string, (props: { active: boolean }) => ReactNode> = {
  Voxx: VoxxArtifact,
  Beakcrypt: BeakcryptArtifact,
  Sudoku: SudokuArtifact,
  FuseIon: FuseIonArtifact,
  Retailytics: RetailyticsState,
  "Family Tree": FamilyTreeArtifact,
};

function Row({
  index,
  active,
  onHover,
}: {
  index: number;
  active: boolean;
  onHover: (index: number | null) => void;
}) {
  const project = work[index]!;
  const Artifact = ARTIFACTS[project.name];
  const demo = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = demo.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, Artifact]);

  return (
    <li
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onHover(index);
      }}
      onPointerLeave={() => onHover(null)}
      className="group grid gap-8 border-t border-border/70 py-14 first:pt-0 last:pb-0 lg:grid-cols-12 lg:items-center lg:gap-12"
    >
      <div className="flex flex-col gap-3 lg:col-span-6">
        <h3 className="text-[clamp(2.5rem,5.5vw,4.75rem)] leading-[0.95] font-medium tracking-[-0.04em]">
          <a
            href={project.link}
            {...externalProps(true)}
            className="inline-flex items-start gap-3 decoration-2 underline-offset-[0.15em] hover:underline"
          >
            {project.name}
            <ArrowUpRight
              className="mt-[0.15em] size-[0.45em] opacity-40 transition-all group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:opacity-100"
              aria-hidden="true"
            />
          </a>
        </h3>
        <p className="max-w-md text-xl leading-snug text-muted-foreground sm:text-2xl">
          {project.tagline}
        </p>
      </div>
      {Artifact && (
        <div
          ref={demo}
          aria-hidden="true"
          data-work-demo
          className="mx-auto h-80 w-full max-w-[34rem] lg:col-span-6 lg:col-start-7"
        >
          {near && (
            <Artifact
              key={
                project.name === "Retailytics"
                  ? "map"
                  : active
                    ? "playing"
                    : "finished"
              }
              active={active}
            />
          )}
        </div>
      )}
    </li>
  );
}

export function Artifacts({ className }: { className?: string }) {
  const list = useRef<HTMLOListElement>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const height = window.innerHeight;
      let closest: number | null = null;
      let distance = Infinity;
      if (!document.hidden) {
        list.current
          ?.querySelectorAll("[data-work-demo]")
          .forEach((demo, i) => {
            const box = demo.getBoundingClientRect();
            const centre = box.top + box.height / 2;
            const nextDistance = Math.abs(centre - height / 2);
            if (
              centre >= height * 0.25 &&
              centre <= height * 0.75 &&
              nextDistance < distance
            ) {
              closest = i;
              distance = nextDistance;
            }
          });
      }
      if (document.hidden) setHovered(null);
      setFocused(closest);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    if (list.current) observer.observe(list.current);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [reduce]);

  return (
    <ol ref={list} className={className}>
      {work.map((p, i) => (
        <Row
          key={p.name}
          index={i}
          active={!reduce && (hovered ?? focused) === i}
          onHover={setHovered}
        />
      ))}
    </ol>
  );
}
