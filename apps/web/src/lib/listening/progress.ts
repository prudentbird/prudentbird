export type ProgressSnapshot = {
  progress: number;
  duration: number;
  isPlaying: boolean;
  receivedAt: number;
};

export function estimateProgressMs(snapshot: ProgressSnapshot, now: number) {
  const elapsed = snapshot.isPlaying
    ? Math.max(0, now - snapshot.receivedAt)
    : 0;
  return Math.min(snapshot.duration, snapshot.progress + elapsed);
}
