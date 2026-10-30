"use client";

import { Float } from "@react-three/drei/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  Color,
  type Group,
  type InstancedMesh,
  MeshStandardMaterial,
  Matrix4,
  Object3D,
  Plane,
  Ray,
  Vector2,
  Vector3,
} from "three";
import { AVATAR_PALETTE, AVATAR_ROWS } from "./avatar-pixels";
import { cn } from "~/lib/utils";
import { Stage, useStageEnv } from "./stage";

const UNIT = 0.2;
// The camera frames the bird snugly, so the layout box is the bird itself;
// the canvas bleeds past it for pushed blocks, hops and bursts.
const CAMERA = { position: [0, 0, 8.6] as [number, number, number], fov: 30 };
const BLEED = 1.7;

type Voxel = {
  target: Vector3;
  color: string;
  scale: number;
  /** Part of the #1990 plate: its backing, or the raised glyphs. */
  tag?: "plate" | "glyph";
};

// A little "#1990" plate pinned to the bird's chest: the avatar is Solana
// Penguin Business #1990, and clicking the plate opens it on Magic Eden.
const NFT_HREF =
  "https://magiceden.io/item-details/FWcEzs13GzBCybYHw5wKvT7vo9QJr96mTq5hQsyqQ97x";
const TAG_ROWS = [
  ".............................",
  "..#.#...#..###.###.###...###.",
  ".#####.##..#.#.#.#.#.#....##.",
  "..#.#...#..###.###.#.#...#.#.",
  ".#####..#....#...#.#.#..#....",
  "..#.#..###.###.###.###.#.....",
  ".............................",
];
const TAG_UNIT = 0.055;
const TAG_CENTER = new Vector3(1.05, -1.62, 0.26);
// The glyphs light up in the cap's green on hover, and a glint of it sweeps
// across them every so often to hint that the plate does something.
const TAG_GLYPH = new Color(AVATAR_PALETTE[2]);
const TAG_LIT = new Color(AVATAR_PALETTE[3]);
const TAG_LIFT = 0.16;
const TAG_GROW = 0.08;
const GLINT_LENGTH = 0.9;
const nextGlintIn = () => 4 + Math.random() * 4;
const TAG_HALF_X = (TAG_ROWS[0]!.length * TAG_UNIT) / 2;
const TAG_HALF_Y = (TAG_ROWS.length * TAG_UNIT) / 2;

function buildVoxels(): Voxel[] {
  const cells: { x: number; y: number; c: string }[] = [];
  AVATAR_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ".")
        cells.push({
          x,
          y,
          c: AVATAR_PALETTE["abcdefghijklmnop".indexOf(ch)]!,
        });
    }),
  );
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const bird = cells.map(({ x, y, c }) => ({
    target: new Vector3((x - cx) * UNIT, -(y - cy) * UNIT, 0),
    color: c,
    scale: 1,
  }));
  const tag: Voxel[] = [];
  TAG_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const raised = ch === "#";
      tag.push({
        target: new Vector3(
          TAG_CENTER.x - TAG_HALF_X + (x + 0.5) * TAG_UNIT,
          TAG_CENTER.y + TAG_HALF_Y - (y + 0.5) * TAG_UNIT,
          TAG_CENTER.z + (raised ? TAG_UNIT * 0.7 : 0),
        ),
        color: raised ? AVATAR_PALETTE[2]! : AVATAR_PALETTE[0]!,
        scale: TAG_UNIT / UNIT,
        tag: raised ? "glyph" : "plate",
      });
    }),
  );
  return [...bird, ...tag];
}

// The cursor pushes nearby blocks apart; they spring back once it moves on.
const PUSH_RADIUS = 0.9;
const PUSH_BASE = 18;
const PUSH_PER_SPEED = 9;
const SPRING = 55;
const DAMPING = 8;
const clamp1 = (n: number) => Math.max(-1, Math.min(1, n));

// Every so often the bird does a little trick on its own.
type Trick = "hop" | "wiggle";
const TRICKS: Trick[] = ["hop", "wiggle"];
const TRICK_LENGTH: Record<Trick, number> = {
  hop: 0.9,
  wiggle: 0.9,
};
const nextTrickIn = () => 5 + Math.random() * 6;

// Clicking agitates the bird: it jitters harder with each quick click, and
// enough of them in a row make it burst apart and snap back together.
const AGITATION_DECAY = 1;
// How fast the jitter dies away once clicking stops (per second).
const JITTER_DECAY = 8;
// The bird's outline in its own space, for telling clicks on it apart from
// clicks on the empty canvas around it.
const HIT_X = 1.8;
const HIT_Y = 2;
const BURST_AT = 4;
const BURST_SPEED = 7;

