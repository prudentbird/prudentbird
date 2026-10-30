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

// Dragging spins the bird around its vertical axis; let go and it coasts,
// then swings back to face front.
const DRAG_RADIANS_PER_PX = 0.012;
const DRAG_THRESHOLD = 4;
const SPIN_SPRING = 14;
const SPIN_DAMPING = 3.5;
const FULL_TURN = Math.PI * 2;

/** Applies the trick at progress t (0–1) to the bird's inner group. */
function applyTrick(g: Group, trick: Trick | null, t: number) {
  g.position.set(0, 0, 0);
  g.rotation.set(0, 0, 0);
  if (!trick) return;
  const fade = 1 - t;
  switch (trick) {
    case "hop":
      // Two hops, the second smaller.
      g.position.y =
        t < 0.55
          ? Math.sin((t / 0.55) * Math.PI) * 0.45
          : Math.sin(((t - 0.55) / 0.45) * Math.PI) * 0.2;
      break;
    case "wiggle":
      g.rotation.z = Math.sin(t * Math.PI * 6) * 0.16 * fade;
      break;
  }
}

function createPush(count: number) {
  return {
    offsets: Array.from({ length: count }, () => new Vector3()),
    velocities: Array.from({ length: count }, () => new Vector3()),
    cursor: new Vector3(),
    last: null as Vector3 | null,
    ray: new Ray(),
    plane: new Plane(new Vector3(0, 0, 1), 0),
    inverse: new Matrix4(),
    away: new Vector3(),
  };
}

function Avatar({ animate }: { animate: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const group = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const time = useRef(0);
  const agitation = useRef(0);
  const jitter = useRef(0);
  const burst = useRef(false);
  const trick = useRef<{ name: Trick | null; at: number }>({
    name: null,
    at: nextTrickIn(),
  });
  const [voxels] = useState(buildVoxels);
  const dummy = useRef(new Object3D());
  const [geometry] = useState(
    () => new BoxGeometry(UNIT * 0.94, UNIT * 0.94, UNIT * 1.6),
  );
  const [material] = useState(
    () => new MeshStandardMaterial({ roughness: 0.42, metalness: 0.05 }),
  );

  const renderer = useThree((state) => state.renderer);
  const get = useThree((state) => state.get);
  const hovering = useRef(false);
  const hoveringTag = useRef(false);
  const lift = useRef(0);
  const spin = useRef({ angle: 0, velocity: 0, dragging: false });
  const glint = useRef(2);
  const [glyphColor] = useState(() => new Color());
  const pushRef = useRef(createPush(voxels.length));

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    voxels.forEach((v, i) => m.setColorAt(i, new Color(v.color)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [voxels]);

  useEffect(() => {
    const push = pushRef.current;
    const el = renderer.domElement;
    // Listen on the canvas rather than the blocks: the cursor push clears a
    // hole right under the pointer, so rapid clicks would land on nothing.
    const hit = new Vector3();
    const ndc = new Vector2();
    const tagPlane = new Plane(new Vector3(0, 0, 1), -TAG_CENTER.z);
    /** Where the pointer meets the given plane, in the bird's own space. */
    const project = (event: PointerEvent, plane: Plane) => {
      const b = inner.current;
      if (!b) return null;
      const rect = el.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const { raycaster, camera } = get();
      raycaster.setFromCamera(ndc, camera);
      push.inverse.copy(b.matrixWorld).invert();
      push.ray.copy(raycaster.ray).applyMatrix4(push.inverse);
      return push.ray.intersectPlane(plane, hit);
    };
    const onTag = (event: PointerEvent) => {
      const p = project(event, tagPlane);
      return (
        !!p &&
        Math.abs(p.x - TAG_CENTER.x) <= TAG_HALF_X &&
        Math.abs(p.y - TAG_CENTER.y) <= TAG_HALF_Y
      );
    };
    const drag = { id: -1, x: 0, t: 0, moved: 0 };
    const sp = spin.current;
    /** Whether the pointer is on the bird, or the bird is already turned. */
    const grabbable = (event: PointerEvent) => {
      if (Math.abs(sp.angle) > 0.3) return true;
      const p = project(event, push.plane);
      return !!p && Math.abs(p.x) <= HIT_X && Math.abs(p.y) <= HIT_Y;
    };
    const move = (event: PointerEvent) => {
      if (sp.dragging && event.pointerId === drag.id) {
        const dx = event.clientX - drag.x;
        const now = performance.now();
        const dt = Math.max(0.001, (now - drag.t) / 1000);
        drag.moved += Math.abs(dx);
        sp.angle += dx * DRAG_RADIANS_PER_PX;
        sp.velocity = (dx * DRAG_RADIANS_PER_PX) / dt;
        drag.x = event.clientX;
        drag.t = now;
        return;
      }
      hovering.current = true;
      hoveringTag.current = onTag(event);
      el.style.cursor = hoveringTag.current ? "pointer" : "";
    };
    const leave = () => {
      hovering.current = false;
      hoveringTag.current = false;
      push.last = null;
      if (!sp.dragging) el.style.cursor = "";
    };
    const down = (event: PointerEvent) => {
      if (onTag(event)) {
        window.open(NFT_HREF, "_blank", "noopener,noreferrer");
        return;
      }
      if (!grabbable(event)) return;
      drag.id = event.pointerId;
      drag.x = event.clientX;
      drag.t = performance.now();
      drag.moved = 0;
      sp.dragging = true;
      sp.velocity = 0;
      hovering.current = false;
      push.last = null;
      el.setPointerCapture(event.pointerId);
      el.style.cursor = "grabbing";
    };
    const up = (event: PointerEvent) => {
      if (!sp.dragging || event.pointerId !== drag.id) return;
      sp.dragging = false;
      drag.id = -1;
      el.style.cursor = "";
      // A press that barely moved is a poke, not a spin.
      if (drag.moved > DRAG_THRESHOLD || !animate) return;
      agitation.current += 1;
      jitter.current = Math.min(1, 0.4 + (agitation.current / BURST_AT) * 0.6);
      if (agitation.current >= BURST_AT) {
        agitation.current = 0;
        burst.current = true;
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [renderer, get, animate]);

  useFrame(({ pointer, camera, raycaster }, delta) => {
    const m = mesh.current;
    const g = group.current;
    const b = inner.current;
    if (!m || !g || !b) return;
    // Clamped both ways: a resumed canvas can report a huge or negative delta,
    // and a negative step would run the springs backwards and blow them up.
    const dt = Math.max(0, Math.min(delta, 1 / 30));
    // Our own clock: r3f resets clock.elapsedTime to 0 whenever the canvas
    // pauses and resumes (scrolled away, hidden on resize), which would leave
    // a trick's end time far in the future and send the wiggle out of range.
    time.current += dt;
    const now = time.current;
    const push = pushRef.current;

    // Idle tricks: pick one at random, play it, then wait a few seconds.
    const tr = trick.current;
    if (animate && now >= tr.at) {
      if (tr.name) {
        tr.name = null;
        tr.at = now + nextTrickIn();
      } else {
        tr.name = TRICKS[Math.floor(Math.random() * TRICKS.length)]!;
        tr.at = now + TRICK_LENGTH[tr.name];
      }
    }
    applyTrick(
      b,
      tr.name,
      tr.name
        ? Math.min(1, Math.max(0, 1 - (tr.at - now) / TRICK_LENGTH[tr.name]))
        : 0,
    );
    // Jitter after a click, on top of whatever trick is playing; it settles
    // within a fraction of a second once the clicks stop.
    agitation.current = Math.max(0, agitation.current - AGITATION_DECAY * dt);
    jitter.current *= Math.exp(-JITTER_DECAY * dt);
    if (jitter.current > 0.01) {
      b.rotation.z += Math.sin(now * 38) * 0.12 * jitter.current;
      b.position.x += Math.sin(now * 47) * 0.08 * jitter.current;
    }
    // Drag spin: follow the pointer while held, then coast and settle on the
    // nearest full turn so the bird ends up facing front again.
    const sp = spin.current;
    if (sp.dragging) {
      sp.velocity *= Math.exp(-12 * dt);
    } else {
      const home = Math.round(sp.angle / FULL_TURN) * FULL_TURN;
      sp.velocity +=
        (SPIN_SPRING * (home - sp.angle) - SPIN_DAMPING * sp.velocity) * dt;
      sp.angle += sp.velocity * dt;
      if (Math.abs(sp.angle - home) < 1e-3 && Math.abs(sp.velocity) < 1e-2) {
        sp.angle = 0;
        sp.velocity = 0;
      }
    }
    b.rotation.y = sp.angle;
    b.updateMatrixWorld();

    // Where the cursor meets the avatar's plane, in the avatar's own space.
    let speed = 0;
    const pushing =
      animate && hovering.current && !sp.dragging && Math.abs(sp.angle) < 0.2;
    if (pushing) {
      raycaster.setFromCamera(pointer, camera);
      push.inverse.copy(b.matrixWorld).invert();
      push.ray.copy(raycaster.ray).applyMatrix4(push.inverse);
      if (push.ray.intersectPlane(push.plane, push.cursor)) {
        if (push.last && dt > 0) speed = push.cursor.distanceTo(push.last) / dt;
        push.last = (push.last ?? new Vector3()).copy(push.cursor);
      }
    }

    // The plate eases forward under the cursor; with reduced motion it only
    // changes color.
    lift.current +=
      ((hoveringTag.current ? 1 : 0) - lift.current) * Math.min(1, dt * 14);
    const rise = animate ? lift.current : 0;
    const grow = 1 + TAG_GROW * rise;
    // Glint progress 0–1 while sweeping; it waits off the plate in between.
    let sweep = -1;
    if (animate) {
      if (now >= glint.current + GLINT_LENGTH)
        glint.current = now + nextGlintIn();
      if (now >= glint.current) sweep = (now - glint.current) / GLINT_LENGTH;
    }
    let recolor = false;

    const bursting = burst.current;
    burst.current = false;
    const d = dummy.current;
    voxels.forEach((v, i) => {
      const off = push.offsets[i]!;
      const vel = push.velocities[i]!;
      if (bursting) {
        push.away
          .set(v.target.x, v.target.y, 0.6)
          .normalize()
          .multiplyScalar(BURST_SPEED * (0.6 + Math.random() * 0.8));
        vel.add(push.away);
      }
      if (pushing && push.last) {
        push.away.copy(v.target).sub(push.cursor).setZ(0);
        const dist = push.away.length();
        if (dist < PUSH_RADIUS) {
          const k =
            (1 - dist / PUSH_RADIUS) ** 2 *
            (PUSH_BASE + speed * PUSH_PER_SPEED) *
            dt;
          push.away.normalize();
          vel.x += push.away.x * k;
          vel.y += push.away.y * k;
          vel.z += k * 0.7;
        }
      }
      vel.x += (-SPRING * off.x - DAMPING * vel.x) * dt;
      vel.y += (-SPRING * off.y - DAMPING * vel.y) * dt;
      vel.z += (-SPRING * off.z - DAMPING * vel.z) * dt;
      off.addScaledVector(vel, dt);

      d.position.copy(v.target);
      if (v.tag) {
        d.position.sub(TAG_CENTER).multiplyScalar(grow).add(TAG_CENTER);
        d.position.z += TAG_LIFT * rise;
      }
      d.position.add(off);
      if (v.tag === "glyph") {
        const u = (v.target.x - TAG_CENTER.x) / (TAG_HALF_X * 2) + 0.5;
        const shine =
          sweep < 0 ? 0 : Math.max(0, 1 - Math.abs(u - sweep * 1.4 + 0.2) * 5);
        glyphColor.copy(TAG_GLYPH).lerp(TAG_LIT, Math.max(lift.current, shine));
        m.setColorAt(i, glyphColor);
        recolor = true;
      }
      d.rotation.set(off.y * 2, -off.x * 2, off.z);
      d.scale.setScalar(v.tag ? v.scale * grow : v.scale);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (recolor && m.instanceColor) m.instanceColor.needsUpdate = true;
    // Turn toward the cursor, with a little idle sway. The canvas bleeds past
    // the avatar, so scale the pointer back to the avatar's own box.
    const sway = animate ? Math.sin(now * 0.6) * 0.12 : 0;
    const px = clamp1(pointer.x * BLEED);
    const py = clamp1(pointer.y * BLEED);
    g.rotation.y += (px * 0.55 + sway - g.rotation.y) * 0.06;
    g.rotation.x += (-py * 0.3 - g.rotation.x) * 0.06;
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        <instancedMesh ref={mesh} args={[geometry, material, voxels.length]} />
      </group>
    </group>
  );
}

