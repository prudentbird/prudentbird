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

