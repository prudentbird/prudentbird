export type SpotifyTrack = {
  url: string;
  name: string;
  artist: string;
  images: {
    small: string;
    medium: string;
  };
  duration: number;
  progress: number;
  isPlaying: boolean;
};

type RawTrack = {
  is_playable?: boolean;
  type?: string;
  name?: string;
  duration_ms?: number;
  external_urls?: { spotify?: string };
  artists?: Array<{ name: string }>;
  album?: { images?: Array<{ url: string; width?: number }> };
};

export function toSpotifyTrack(
  item: RawTrack | null | undefined,
  state: { isPlaying: boolean; progress: number },
): SpotifyTrack | null {
  if (
    item?.is_playable === false ||
    !item?.name ||
    (item.type && item.type !== "track")
  )
    return null;

  const sorted = [...(item.album?.images ?? [])].sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0),
  );
  const large = sorted[0]?.url ?? "";

  return {
    name: item.name,
    artist: (item.artists ?? []).map((artist) => artist.name).join(", "),
    images: {
      small: sorted[sorted.length - 1]?.url ?? large,
      medium: sorted[1]?.url ?? large,
    },
    url: item.external_urls?.spotify ?? "",
    isPlaying: state.isPlaying,
    duration: item.duration_ms ?? 0,
    progress: state.progress,
  };
}
