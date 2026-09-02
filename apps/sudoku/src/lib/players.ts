/** Shared player palette. Indexed by `players.color`. */
export const PLAYER_COLORS = [
  "oklch(0.62 0.19 260)", // blue
  "oklch(0.64 0.21 15)", // rose
  "oklch(0.64 0.17 150)", // green
  "oklch(0.72 0.17 70)", // amber
  "oklch(0.6 0.2 300)", // violet
  "oklch(0.66 0.13 200)", // teal
  "oklch(0.68 0.19 40)", // orange
  "oklch(0.66 0.2 340)", // pink
] as const;

export function playerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]!.toUpperCase())
      .join("") || "?"
  );
}
