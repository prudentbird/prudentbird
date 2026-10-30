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

