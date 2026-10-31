"use client";

import Image from "next/image";
import { Loader2, Music2, Pause, Play, Square } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { TextSkeleton } from "~/components/ui/text-skeleton";
import { cn } from "~/lib/utils";
import { externalProps } from "~/lib/content";
import {
  trackHref,
  useListeningHistory,
  useNowPlaying,
  useTrackProgress,
} from "~/lib/live";
import { findYouTubeMatch } from "~/app/actions/youtube";
import { PLAYING, type YTPlayer, loadYouTubeApi } from "./youtube-player";

const BAR = 10;
const GAP = 3;
const DAY = 86_400_000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () =>
    ((s =
      Math.imul(s ^ (s >>> 15), 2246822507) ^
      Math.imul(s ^ (s >>> 13), 3266489909)) >>>
      0) /
    4294967296;
}

function fingerprint(count: number, seed: number) {
  const r = rng(seed);
  const bumps = Array.from({ length: 4 }, () => ({
    c: r(),
    w: 0.06 + r() * 0.18,
    a: 0.4 + r() * 0.6,
  }));
  const bars = Array.from({ length: count }, (_, i) => {
    const x = i / Math.max(1, count - 1);
    const env = bumps.reduce(
      (v, b) => v + b.a * Math.exp(-((x - b.c) ** 2) / (2 * b.w ** 2)),
      0,
    );
    return (
      (0.25 + env * 0.6 + r() * 0.25) *
      (0.35 + 0.65 * Math.min(1, x * 12, (1 - x) * 12))
    );
  });
  const max = Math.max(...bars);
  return {
    heights: bars.map((b) => Math.max(0.06, b / max)),
    motion: bars.map(() => ({ f: 1.6 + r() * 3.2, p: r() * Math.PI * 2 })),
    beat: 60 / (84 + Math.floor(r() * 50)),
  };
}

function useCoverAccent(src: string | undefined) {
  const [accent, setAccent] = useState<{ h: number; c: number } | null>(null);
  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 24;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 24, 24);
      const d = ctx.getImageData(0, 0, 24, 24).data;
      let x = 0,
        y = 0,
        w = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [r, g, b] = [d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255];
        const max = Math.max(r, g, b),
          sat = max - Math.min(r, g, b);
        if (sat < 0.2 || max < 0.2) continue;
        const h =
          max === r
            ? ((g - b) / sat) % 6
            : max === g
              ? (b - r) / sat + 2
              : (r - g) / sat + 4;
        x += Math.cos((h * Math.PI) / 3) * sat;
        y += Math.sin((h * Math.PI) / 3) * sat;
        w += sat;
      }
      setAccent(
        w
          ? { h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, c: 0.16 }
          : { h: 55, c: 0.02 },
      );
    };
    img.src = src;
  }, [src]);
  return accent;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const noop = () => () => {};
const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Player = "off" | "loading" | "on" | "missing";

export function SongVisualizer() {
  const { track, isLoading: resolving } = useNowPlaying();
  const { history, isLoading: historyLoading } = useListeningHistory();
  const myProgress = useTrackProgress(track);
  const reduce = useReducedMotion();
  const today = useSyncExternalStore(
    noop,
    () => dayKey(new Date()),
    () => null,
  );
  const accent = useCoverAccent(track?.images.small);

  const viewport = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const caps = useRef<(HTMLSpanElement | null)[]>([]);
  const [visibleCount, setCount] = useState(96);
  const [hovered, setHovered] = useState<number | null>(null);

  const ytHost = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const loadedFor = useRef<string | null>(null);
  const session = useRef(0);
  const lookup = useRef(0);
  const pendingFor = useRef<string | null>(null);
  const latestTrack = useRef(track);
  latestTrack.current = track;
  const [player, setPlayer] = useState<Player>("off");
  const [playback, setPlayback] = useState<{
    position: number;
    duration: number;
    isPaused: boolean;
    at: number;
  } | null>(null);
  const [now, setNow] = useState(0);

  const listening = player === "on" && playback !== null;
  const showHistory = !listening;
  const count = useMemo(() => {
    if (!showHistory || !today || !history?.length) return visibleCount;
    const earliest = history.reduce(
      (date, day) => (day.date < date ? day.date : date),
      today,
    );
    return Math.max(
      visibleCount,
      Math.round((Date.parse(today) - Date.parse(earliest)) / DAY) + 1,
    );
  }, [showHistory, today, history, visibleCount]);

  useEffect(() => {
    const el = viewport.current;
    if (el) el.scrollLeft = showHistory ? el.scrollWidth : 0;
  }, [showHistory, count]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setCount(
        Math.max(24, Math.floor((e!.contentRect.width + GAP) / (BAR + GAP))),
      ),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const skeleton = useMemo(
    () => fingerprint(count, hash("prudentbird")).heights,
    [count],
  );
  const shape = useMemo(
    () => fingerprint(count, hash(track?.url || track?.name || "prudentbird")),
    [count, track?.url, track?.name],
  );

  const days = useMemo(() => {
    if (!today) return [];
    const map = new Map((history ?? []).map((d) => [d.date, d]));
    const end = new Date(`${today}T12:00:00`).getTime();
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(end - (count - 1 - i) * DAY);
      const d = map.get(dayKey(date));
      const artists = new Map<string, number>();
      for (const t of d?.tracks ?? [])
        artists.set(t.artist, (artists.get(t.artist) ?? 0) + 1);
      return {
        date,
        plays: d?.count ?? 0,
        top: [...artists.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      };
    });
  }, [history, today, count]);
  const dayMax = Math.max(1, ...days.map((d) => d.plays));

  const playingHere = listening && !playback.isPaused;

  useEffect(() => {
    if (player !== "on") return;
    const id = setInterval(() => {
      const p = yt.current;
      if (!p?.getDuration) return;
      setPlayback({
        position: p.getCurrentTime() * 1000,
        duration: p.getDuration() * 1000,
        isPaused: p.getPlayerState() !== PLAYING,
        at: performance.now(),
      });
      setNow(performance.now());
    }, 250);
    return () => clearInterval(id);
  }, [player]);
  const position = listening
    ? Math.min(
        playback.duration,
        playback.position +
          (playback.isPaused ? 0 : Math.max(0, now - playback.at)),
      )
    : track
      ? myProgress * track.duration
      : 0;
  const duration = listening ? playback.duration : (track?.duration ?? 0);
  const progress = duration ? position / duration : 0;
  const moving = !reduce && (listening ? playingHere : !!track?.isPlaying);

  const levels = useRef<number[]>([]);
  const peaks = useRef<number[]>([]);
  const second = Math.floor(position / 1000);

  useEffect(() => {
    const els = bars.current;
    const capEls = caps.current;
    const draw = (
      heights: (i: number) => number,
      capsAt: ((i: number) => number) | null,
      transition: string,
    ) => {
      for (let i = 0; i < count; i++) {
        const el = els[i];
        if (el) {
          el.style.transition = transition;
          el.style.transform = `scaleY(${Math.min(1, Math.max(0.02, heights(i))).toFixed(3)})`;
        }
        const cap = capEls[i];
        if (cap) {
          cap.style.opacity = capsAt ? "1" : "0";
          if (capsAt)
            cap.style.transform = `translateY(${((1 - Math.min(1, capsAt(i))) * 100).toFixed(2)}%)`;
        }
      }
    };
    const smooth = "transform 450ms cubic-bezier(.2,.8,.2,1)";

    if (showHistory) {
      draw(
        historyLoading || !today
          ? (i) => 0.12 + 0.3 * (skeleton[i] ?? 0.5)
          : (i) => (days[i] ? Math.max(0.025, days[i]!.plays / dayMax) : 0.025),
        null,
        smooth,
      );
      return;
    }

    const loudness = (p: number) =>
      0.55 +
      0.45 * (shape.heights[Math.min(count - 1, Math.floor(p * count))] ?? 0.5);
    const frame = (t: number, p: number, out: number[]) => {
      const beat = shape.beat;
      const bp = (t % beat) / beat;
      const beatIdx = Math.floor(t / beat);
      const kick = Math.exp(-bp * 7);
      const snare = beatIdx % 2 === 1 ? Math.exp(-bp * 9) : 0;
      const hat = Math.exp(-((t % (beat / 2)) / (beat / 2)) * 14);
      const section = loudness(p);
      for (let i = 0; i < count; i++) {
        const x = i / Math.max(1, count - 1);
        const m = shape.motion[i]!;
        const flutter =
          (0.5 +
            0.5 *
              Math.sin(t * m.f + m.p) *
              Math.sin(t * m.f * 0.37 + m.p * 1.7)) **
          2;
        const tilt = 0.85 * (1 - x) ** 0.7 + 0.1;
        const timbre = 0.6 + 0.4 * shape.heights[i]!;
        out[i] =
          tilt * timbre * (0.22 + 0.78 * flutter) * section +
          0.9 * kick * Math.exp(-(((x - 0.04) / 0.07) ** 2)) +
          0.55 *
            snare *
            Math.exp(-(((x - 0.38) / 0.14) ** 2)) *
            (0.6 + 0.4 * flutter) +
          (x > 0.6 ? 0.35 * hat * (0.4 + 0.6 * flutter) : 0);
      }
      return out;
    };

    const target: number[] = new Array(count).fill(0);
    const lv = levels.current;
    const pk = peaks.current;
    lv.length = pk.length = count;

    if (!moving) {
      frame(second || 1, progress, target);
      for (let i = 0; i < count; i++)
        lv[i] = pk[i] = Math.min(1, target[i]! ** 0.85);
      draw(
        (i) => lv[i]!,
        (i) => pk[i]!,
        smooth,
      );
      return;
    }

    let raf = 0;
    const start = performance.now();
    const base = position / 1000;
    const tick = (now: number) => {
      const t = base + (now - start) / 1000;
      frame(t, duration ? (t * 1000) / duration : progress, target);
      for (let i = 0; i < count; i++) {
        const cur = lv[i] ?? 0;
        const next =
          target[i]! > cur
            ? cur + (target[i]! - cur) * 0.7
            : cur * 0.88 + target[i]! * 0.12;
        lv[i] = next;
        const shown = Math.min(1, next ** 0.85);
        pk[i] =
          shown >= (pk[i] ?? 0) ? shown : Math.max(shown, (pk[i] ?? 0) - 0.007);
      }
      draw(
        (i) => Math.min(1, lv[i]! ** 0.85),
        (i) => pk[i]!,
        "none",
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showHistory,
    historyLoading,
    today,
    skeleton,
    moving,
    shape,
    days,
    dayMax,
    count,
    second,
  ]);

  const listen = async (t: NonNullable<typeof track>) => {
    const s = session.current;
    const l = ++lookup.current;
    pendingFor.current = t.url;
    const stale = () => s !== session.current || l !== lookup.current;
    const found = await findYouTubeMatch();
    if (stale()) return;
    const id = found?.url === t.url ? found.id : null;
    if (!id) {
      setPlayer("missing");
      return;
    }
    const startAt = t.isPlaying ? (myProgress * t.duration) / 1000 : 0;
    loadedFor.current = t.url;
    if (yt.current) {
      yt.current.loadVideoById({ videoId: id, startSeconds: startAt });
      return;
    }
    let YT;
    try {
      YT = await loadYouTubeApi();
    } catch {
      if (!stale()) {
        loadedFor.current = null;
        setPlayer("missing");
      }
      return;
    }
    if (stale()) return;
    const host = document.createElement("div");
    ytHost.current?.replaceChildren(host);
    yt.current = new YT.Player(host, {
      videoId: id,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        start: Math.floor(startAt),
        controls: 0,
        disablekb: 1,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3,
        fs: 0,
      },
      events: {
        onReady: () => {
          if (s !== session.current) return;
          yt.current?.playVideo();
          setPlayer("on");
        },
        onError: () => {
          if (s !== session.current) return;
          const latest = latestTrack.current;
          const superseded = !!latest && latest.url !== loadedFor.current;
          yt.current?.destroy();
          yt.current = null;
          loadedFor.current = null;
          ytHost.current?.replaceChildren();
          setPlayback(null);
          if (superseded) {
            listen(latest).catch(() => setPlayer("missing"));
            return;
          }
          setPlayer("missing");
        },
      },
    });
  };

  const stop = () => {
    session.current++;
    yt.current?.destroy();
    yt.current = null;
    loadedFor.current = null;
    ytHost.current?.replaceChildren();
    setPlayback(null);
    setPlayer("off");
  };

  const toggle = () => {
    if (!track) return;
    if (player === "on" && yt.current) {
      if (playback && !playback.isPaused) yt.current.pauseVideo();
      else yt.current.playVideo();
      return;
    }
    setPlayer("loading");
    listen(track).catch(() => setPlayer("missing"));
  };

  useEffect(() => {
    if (!track || track.url === loadedFor.current) return;
    if (player === "loading") {
      if (yt.current || track.url === pendingFor.current) return;
    } else if (player !== "on") return;
    listen(track).catch(() => setPlayer("missing"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.url, player]);

  useEffect(
    () => () => {
      session.current++;
      yt.current?.destroy();
    },
    [],
  );

  const seekTo = (i: number) => {
    if (!listening || !yt.current) return;
    yt.current.seekTo(((i + 0.5) / count) * (playback.duration / 1000), true);
  };

  const played = Math.floor(progress * count);
  const hoveredDay = hovered !== null ? days[hovered] : null;
  const indexAt = (x: number) => {
    const r = strip.current!.getBoundingClientRect();
    return Math.min(
      count - 1,
      Math.max(0, Math.floor((x - r.left) / (BAR + GAP))),
    );
  };
  const totalPlays = days.reduce((n, d) => n + d.plays, 0);
  const active = player === "loading" || player === "on";
  const captions = {
    missing:
      "I couldn't find this song on YouTube, so here's my daily listening instead.",
    history:
      "One bar per day of listening. Scroll back for earlier days, or pick a bar to see what I played.",
    listening:
      "Playing the full song from YouTube. Tap the bars to jump around.",
  };
  const dayLine = hoveredDay
    ? [
        hoveredDay.date.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        hoveredDay.plays
          ? `${hoveredDay.plays} ${hoveredDay.plays === 1 ? "play" : "plays"}`
          : "Quiet day",
        hoveredDay.top && `mostly ${hoveredDay.top}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const caption =
    player === "missing"
      ? "missing"
      : showHistory
        ? hoveredDay && !historyLoading
          ? "day"
          : "history"
        : "listening";
  const hue = accent?.h ?? 55;
  const chroma = accent?.c ?? 0.17;

  return (
    <div
      className="relative isolate"
      style={{ "--tint": `oklch(0.7 ${chroma} ${hue})` } as CSSProperties}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-5 md:gap-x-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-8">
        <div className="relative size-28 shrink-0 self-center overflow-hidden rounded-2xl bg-muted shadow-lg md:row-span-2 md:size-32 md:self-end lg:row-span-1">
          {resolving ? (
            <Skeleton className="absolute inset-0 grid place-items-center rounded-none">
              <Music2
                className="size-8 text-muted-foreground/40"
                aria-hidden="true"
              />
            </Skeleton>
          ) : (
            <a
              href={track ? trackHref(track) : undefined}
              {...externalProps}
              tabIndex={player === "on" ? -1 : undefined}
              className="absolute inset-0"
            >
              {track?.images.medium ? (
                <Image
                  key={track.images.medium}
                  src={track.images.medium}
                  alt=""
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <Music2
                  className="absolute inset-0 m-auto size-10 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {track && (
                <span className="sr-only">Open {track.name} on Spotify</span>
              )}
            </a>
          )}
          <div
            ref={ytHost}
            aria-label="YouTube player"
            aria-hidden={player !== "on"}
            className={cn(
              "absolute inset-0 bg-black transition-opacity duration-300 [&_iframe]:size-full",
              player === "on" ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
        </div>

        <div className="min-w-0 self-center md:self-end">
          {resolving ? (
            <div aria-hidden="true">
              <TextSkeleton className="w-20 text-sm [&>div]:h-[0.8em] [&>div]:rounded-full" />
              <TextSkeleton className="w-[min(16rem,100%)] text-xl font-medium sm:text-3xl [&>div]:rounded-lg [&>div]:[animation-delay:120ms]" />
              <TextSkeleton className="w-32 [&>div]:h-[0.8em] [&>div]:rounded-full [&>div]:[animation-delay:240ms]" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {listening
                  ? "Listening with me"
                  : track
                    ? track.isPlaying
                      ? "Playing now"
                      : "Last played"
                    : "Listening history"}
              </p>
              <p className="line-clamp-2 text-xl font-medium tracking-tight text-balance sm:line-clamp-1 sm:text-3xl sm:text-pretty">
                {track?.name ?? "Recently on repeat"}
              </p>
              <p className="truncate text-muted-foreground">
                {track?.artist ?? "Nothing playing right now"}
              </p>
            </>
          )}
        </div>

        <div className="col-span-2 md:col-span-1 md:col-start-2 lg:col-start-3">
          <div
            className={cn(
              "flex h-11 w-full shrink-0 overflow-hidden rounded-full text-white shadow-sm transition-transform md:w-48",
              resolving
                ? "animate-pulse bg-accent shadow-none [animation-delay:360ms]"
                : "bg-[oklch(0.55_0.15_var(--h))]",
            )}
            aria-hidden={resolving || undefined}
            style={{ ["--h" as string]: hue } as CSSProperties}
          >
            {!resolving && (
              <>
                <button
                  type="button"
                  onClick={toggle}
                  disabled={!track || player === "loading"}
                  aria-pressed={playingHere}
                  data-loading={player === "loading"}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 data-[loading=true]:cursor-wait"
                >
                  {player === "loading" ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : playingHere ? (
                    <Pause className="size-4" aria-hidden="true" />
                  ) : (
                    <Play className="size-4" aria-hidden="true" />
                  )}
                  {playingHere
                    ? "Pause"
                    : listening
                      ? "Resume"
                      : "Listen with me"}
                </button>
                {active && (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop listening"
                    title="Stop listening"
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 border-l text-sm font-medium md:w-12 md:flex-none border-white/20 transition-colors hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none"
                  >
                    <Square
                      className="size-3.5 fill-current"
                      aria-hidden="true"
                    />
                    <span className="md:hidden">Stop</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        ref={viewport}
        className="-mb-[196px] mt-8 overflow-x-auto overscroll-x-contain pt-4 pb-[196px] [scrollbar-width:none] sm:-mb-[228px] sm:pb-[228px] [&::-webkit-scrollbar]:hidden"
      >
        <div
          ref={strip}
          tabIndex={0}
          role="group"
          aria-label={
            showHistory
              ? `Listening history: ${totalPlays} plays over the last ${count} days. Scroll left for older days or use arrow keys to read each day.`
              : "Song progress. Click a bar to jump there."
          }
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setHovered(null);
          }}
          onPointerMove={(e) => setHovered(indexAt(e.clientX))}
          onClick={(e) => {
            if (listening) seekTo(indexAt(e.clientX));
            else setHovered(indexAt(e.clientX));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const step = e.key === "ArrowLeft" ? -1 : 1;
              if (listening)
                seekTo(Math.min(count - 1, Math.max(0, played + step)));
              else if (showHistory) {
                const next = Math.min(
                  count - 1,
                  Math.max(0, (hovered ?? count - 1) + step),
                );
                setHovered(next);
                const el = viewport.current;
                if (el) {
                  const left = next * (BAR + GAP);
                  if (left < el.scrollLeft) el.scrollLeft = left;
                  else if (left + BAR > el.scrollLeft + el.clientWidth)
                    el.scrollLeft = left + BAR - el.clientWidth;
                }
              }
            }
          }}
          className={cn(
            "relative flex h-48 items-end rounded-sm outline-none [-webkit-box-reflect:below_4px_linear-gradient(transparent_55%,rgba(0,0,0,0.22))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:h-56",
            listening ? "cursor-pointer" : "cursor-crosshair",
          )}
          style={{ gap: GAP, width: count * (BAR + GAP) - GAP }}
        >
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="relative h-full shrink-0"
              style={{ width: BAR }}
            >
              <span
                ref={(el) => {
                  bars.current[i] = el;
                }}
                className={cn(
                  "block h-full shrink-0 origin-bottom rounded-[3px] will-change-transform",
                  showHistory &&
                    (historyLoading || !today) &&
                    "animate-pulse bg-foreground/15",
                  showHistory &&
                    !historyLoading &&
                    today &&
                    (i === hovered ? "bg-foreground" : "bg-foreground/35"),
                  !showHistory &&
                    i >= played &&
                    (listening && i === hovered
                      ? "bg-foreground/60"
                      : "bg-foreground/25"),
                )}
                style={{
                  width: BAR,
                  animationDelay: `${(i % 32) * 45}ms`,
                  transform: `scaleY(${(0.12 + 0.3 * (skeleton[i] ?? 0.5)).toFixed(3)})`,
                  ...(!showHistory && i < played
                    ? {
                        background:
                          "linear-gradient(to top, color-mix(in oklch, var(--tint) 75%, black), var(--tint))",
                        boxShadow: "0 0 18px -4px var(--tint)",
                      }
                    : {}),
                }}
              />
              <span
                ref={(el) => {
                  caps.current[i] = el;
                }}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 will-change-transform"
              >
                <span
                  className="absolute inset-x-0 top-0 h-[3px] rounded-full"
                  style={{
                    background:
                      i < played
                        ? "var(--tint)"
                        : "color-mix(in oklch, var(--color-foreground) 70%, transparent)",
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="mt-6 grid text-sm text-muted-foreground"
        aria-live="polite"
      >
        {(Object.keys(captions) as (keyof typeof captions)[]).map((k) => (
          <div
            key={k}
            className={cn(
              "col-start-1 row-start-1 flex items-start justify-between gap-6",
              k !== caption && "invisible",
            )}
          >
            <p>{captions[k]}</p>
            {k === "listening" && (
              <p className="shrink-0 tabular-nums">
                {mmss(position)}
                <span className="text-muted-foreground/50">
                  {" "}
                  / {mmss(duration)}
                </span>
              </p>
            )}
          </div>
        ))}
        <p
          className={cn(
            "col-start-1 row-start-1 truncate text-foreground",
            caption !== "day" && "invisible",
          )}
        >
          {dayLine}
        </p>
      </div>
    </div>
  );
}
