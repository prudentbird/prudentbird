"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { NIGERIA_RING, NIGERIA_SPOTS } from "./nigeria";

const EVERY_MS = 650;
/**
 * The map renders at this multiple of its box and is scaled down to fit, so
 * MapLibre loads tiles a zoom level or two deeper: at country scale that is
 * the difference between a few trunk roads and the whole road network.
 */
const OVERSAMPLE = 3;
const PADDING = 8 * OVERSAMPLE;
const HOLD_MS = 2600;

const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const BOUNDS: [[number, number], [number, number]] = [
  [
    Math.min(...NIGERIA_RING.map((p) => p[0])),
    Math.min(...NIGERIA_RING.map((p) => p[1])),
  ],
  [
    Math.max(...NIGERIA_RING.map((p) => p[0])),
    Math.max(...NIGERIA_RING.map((p) => p[1])),
  ],
];

/** `clip` is in the oversampled map's pixels; `outline` and `spots` in the box's. */
type Shape = {
  clip: string;
  outline: string;
  spots: [number, number][];
  offset: [number, number];
};

/**
 * Redraws the basemap as line art in the site's own ink: no place names, every
 * road and boundary one even hairline (after the scale-down), water a faint
 * tint, so the network reads as a texture inside the border.
 */
function lineArt(map: MapLibreMap, dark: boolean) {
  const ink = dark ? "rgba(255,255,255," : "rgba(0,0,0,";
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === "symbol") {
      map.setLayoutProperty(layer.id, "visibility", "none");
    } else if (layer.type === "line") {
      const road = /road|highway|street|transport|bridge|tunnel|rail/i.test(
        layer.id,
      );
      map.setPaintProperty(
        layer.id,
        "line-color",
        `${ink}${road ? 0.32 : 0.18})`,
      );
      map.setPaintProperty(
        layer.id,
        "line-width",
        (road ? 0.9 : 0.6) * OVERSAMPLE,
      );
    } else if (layer.type === "fill") {
      const water = /water/i.test(layer.id);
      map.setPaintProperty(
        layer.id,
        "fill-color",
        water ? `${ink}0.08)` : "rgba(0,0,0,0)",
      );
      map.setPaintProperty(layer.id, "fill-outline-color", "rgba(0,0,0,0)");
    } else if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", `${ink}0.03)`);
    }
  }
}

/**
 * Retailytics, shown as what it is: field teams surveying a state by hand.
 * Nigeria alone, cut out of the map along its border, with newly recorded
 * outlets popping up inside it until the survey starts over.
 */
export function RetailyticsState({ active }: { active: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const { resolvedTheme } = useTheme();
  const theme: keyof typeof STYLE = resolvedTheme === "dark" ? "dark" : "light";
  const themeRef = useRef(theme);
  // The border and spots in screen pixels, from the map's own projection.
  const [shape, setShape] = useState<Shape | null>(null);
  const [count, setCount] = useState(NIGERIA_SPOTS.length);

  useEffect(() => {
    themeRef.current = theme;
    map.current?.setStyle(STYLE[theme]);
  }, [theme]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("maplibre-gl").then(({ Map, setWorkerUrl }) => {
      if (disposed) return;
      // MapLibre looks for its worker beside its own (bundled) URL, which no
      // longer exists after bundling; point it at the shipped worker file.
      setWorkerUrl(
        new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url)
          .href,
      );
      const current = new Map({
        container: element,
        style: STYLE[themeRef.current],
        bounds: BOUNDS,
        fitBoundsOptions: { padding: PADDING },
        interactive: false,
        attributionControl: false,
      });
      map.current = current;
      // OpenFreeMap's styles name a few fill patterns they don't ship.
      current.setMissingStyleImageResolver((id) => {
        if (!current.hasImage(id))
          current.addImage(id, {
            width: 1,
            height: 1,
            data: new Uint8Array(4),
          });
      });
      current.on("style.load", () =>
        lineArt(current, themeRef.current === "dark"),
      );
      const project = () => {
        const points = NIGERIA_RING.map((p) => current.project([p[0], p[1]]));
        const path = (k: number) =>
          `M${points.map((p) => `${(p.x / k).toFixed(1)} ${(p.y / k).toFixed(1)}`).join(" L")} Z`;
        // Centre the visible border itself, including after its flex box resizes.
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const offset: [number, number] = [
          (element.clientWidth - Math.min(...xs) - Math.max(...xs)) /
            (2 * OVERSAMPLE),
          (element.clientHeight - Math.min(...ys) - Math.max(...ys)) /
            (2 * OVERSAMPLE),
        ];
        setShape({
          offset,
          clip: path(1),
          outline: path(OVERSAMPLE),
          spots: NIGERIA_SPOTS.map((p) => {
            const at = current.project([p[0], p[1]]);
            return [at.x / OVERSAMPLE, at.y / OVERSAMPLE];
          }),
        });
      };
      current.on("load", project);
      observer = new ResizeObserver(() => current.resize());
      observer.observe(element.parentElement!);
      current.on("resize", () => {
        current.fitBounds(BOUNDS, { padding: PADDING, duration: 0 });
        project();
      });
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const step = (n: number) => {
      const next = n >= NIGERIA_SPOTS.length ? 0 : n + 1;
      setCount(next);
      timer = setTimeout(
        () => step(next),
        next >= NIGERIA_SPOTS.length ? HOLD_MS : EVERY_MS,
      );
    };
    // Show the finished survey first, then start again.
    timer = setTimeout(() => step(NIGERIA_SPOTS.length), HOLD_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        {/* MapLibre makes this `position: relative`, so it needs a real size:
            OVERSAMPLE times the box, scaled back down to fit it. */}
        <div
          ref={container}
          className="origin-top-left transition-opacity duration-700"
          style={{
            width: `${OVERSAMPLE * 100}%`,
            height: `${OVERSAMPLE * 100}%`,
            transform: `translate(${shape?.offset[0] ?? 0}px, ${shape?.offset[1] ?? 0}px) scale(${1 / OVERSAMPLE})`,
            clipPath: shape ? `path("${shape.clip}")` : "inset(50%)",
            opacity: shape ? 1 : 0,
          }}
        />
        {shape && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            style={{
              transform: `translate(${shape.offset[0]}px, ${shape.offset[1]}px)`,
            }}
          >
            <path
              d={shape.outline}
              className="fill-none stroke-foreground/60"
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
            {shape.spots
              .slice(0, active ? count : NIGERIA_SPOTS.length)
              .map(([x, y], i) => (
                <g key={i}>
                  <motion.circle
                    cx={x}
                    cy={y}
                    r={5}
                    className="fill-[#16a34a] stroke-background dark:fill-[#4ade80]"
                    strokeWidth={2}
                    initial={active ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 16 }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                  {active && (
                    <motion.circle
                      cx={x}
                      cy={y}
                      className="fill-none stroke-[#16a34a] dark:stroke-[#4ade80]"
                      strokeWidth={1.5}
                      initial={{ r: 5, opacity: 0.9 }}
                      animate={{ r: 22, opacity: 0 }}
                      transition={{ duration: 1.1, ease: "easeOut" }}
                    />
                  )}
                </g>
              ))}
          </svg>
        )}
      </div>
      <p className="text-center text-[10px] text-muted-foreground/60">
        © OpenFreeMap · OpenMapTiles · OpenStreetMap
      </p>
    </div>
  );
}
