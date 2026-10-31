export type ProgressSnapshot = {
  progress: number;
  duration: number;
  isPlaying: boolean;
  /** Client wall-clock time (ms) at which `progress` was true. */
  receivedAt: number;
};

/** Where Spotify's playhead probably is right now, in milliseconds. */
export function estimateProgressMs(snapshot: ProgressSnapshot, now: number) {
  const elapsed = snapshot.isPlaying
    ? Math.max(0, now - snapshot.receivedAt)
    : 0;
  return Math.min(snapshot.duration, snapshot.progress + elapsed);
}
