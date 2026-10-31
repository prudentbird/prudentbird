import { cn } from "~/lib/utils";
import {
  AVATAR_CAMERA,
  AVATAR_ROWS,
  AVATAR_UNIT,
  TAG_CENTER_XYZ,
  TAG_ROWS,
  TAG_UNIT,
} from "./avatar-pixels";

const DISTANCE = AVATAR_CAMERA.position[2];
const VIEW = 2 * DISTANCE * Math.tan(((AVATAR_CAMERA.fov / 2) * Math.PI) / 180);

const LIT = [
  "[--lit-0:#2c324c] dark:[--lit-0:#15192b]",
  "[--lit-1:#dadddc] dark:[--lit-1:#b9bfbc]",
  "[--lit-2:#e6e7e6] dark:[--lit-2:#cdcecc]",
  "[--lit-3:#9ec961] dark:[--lit-3:#689f33]",
  "[--lit-4:#a9bebd] dark:[--lit-4:#76908f]",
  "[--lit-5:#333b58] dark:[--lit-5:#191f32]",
  "[--lit-6:#e8e7e6] dark:[--lit-6:#d1cfcd]",
  "[--lit-7:#fc7d72] dark:[--lit-7:#db4745]",
  "[--lit-8:#68aed3] dark:[--lit-8:#2d7dac]",
  "[--lit-9:#f0a662] dark:[--lit-9:#d17237]",
  "[--lit-10:#32404c] dark:[--lit-10:#172129]",
  "[--lit-11:#4a636c] dark:[--lit-11:#273a40]",
].join(" ");

type Cell = { x: number; y: number; z: number; size: number; color: number };

function rect({ x, y, z, size }: Cell) {
  const k = DISTANCE / (DISTANCE - z);
  const s = +(size * 0.94 * k).toFixed(3);
  return `M${(x * k - s / 2).toFixed(3)} ${(-y * k - s / 2).toFixed(3)}h${s}v${s}h-${s}z`;
}

function buildCells() {
  const bird: { x: number; y: number; c: number }[] = [];
  AVATAR_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ".")
        bird.push({
          x,
          y,
          c: "abcdefghijklmnop".indexOf(ch),
        });
    }),
  );
  const xs = bird.map((c) => c.x);
  const ys = bird.map((c) => c.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cells: Cell[] = bird.map(({ x, y, c }) => ({
    x: (x - cx) * AVATAR_UNIT,
    y: -(y - cy) * AVATAR_UNIT,
    z: 0,
    size: AVATAR_UNIT,
    color: c,
  }));
  const [tx, ty, tz] = TAG_CENTER_XYZ;
  const halfX = (TAG_ROWS[0]!.length * TAG_UNIT) / 2;
  const halfY = (TAG_ROWS.length * TAG_UNIT) / 2;
  TAG_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const raised = ch === "#";
      cells.push({
        x: tx - halfX + (x + 0.5) * TAG_UNIT,
        y: ty + halfY - (y + 0.5) * TAG_UNIT,
        z: tz + (raised ? TAG_UNIT * 0.7 : 0),
        size: TAG_UNIT,
        color: raised ? 2 : 0,
      });
    }),
  );
  const layers = new Map<string, string>();
  for (const cell of cells.sort((a, b) => a.z - b.z)) {
    const key = `${cell.z}|${cell.color}`;
    layers.set(key, (layers.get(key) ?? "") + rect(cell));
  }
  return [...layers].map(([key, d]) => ({
    key,
    fill: `var(--lit-${key.split("|")[1]})`,
    d,
  }));
}

const SPRITE_ID = "avatar-sprite";
const VIEW_BOX = `${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`;

export function AvatarSpriteDefs() {
  return (
    <svg aria-hidden="true" className="absolute size-0 overflow-hidden">
      <symbol id={SPRITE_ID} viewBox={VIEW_BOX}>
        {buildCells().map(({ key, fill, d }) => (
          <path key={key} fill={fill} d={d} />
        ))}
      </symbol>
    </svg>
  );
}

export function AvatarSprite({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none", LIT, className)}
    >
      <use href={`#${SPRITE_ID}`} width="100%" height="100%" />
    </svg>
  );
}
