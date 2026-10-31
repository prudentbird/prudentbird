export type ListenStatus = "off" | "loading" | "on" | "missing";

export type PlayerLike = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  loadVideoById: (o: { videoId: string; startSeconds?: number }) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type TrackRef = { url: string };

export type ListenAlongDeps = {
  /** Finds the YouTube video for whatever Spotify is on right now. */
  match: () => Promise<{ url: string; id: string | null } | null>;
  loadApi: () => Promise<void>;
  /** Seconds into the song Spotify is at *now*; read after every await. */
  startSeconds: () => number;
  createPlayer: (
    videoId: string,
    startSeconds: number,
    events: { onReady: () => void; onError: () => void },
  ) => PlayerLike;
  /** Removes whatever the player left in the DOM. */
  clearHost: () => void;
  onStatus: (status: ListenStatus) => void;
  /** YT.PlayerState.PLAYING */
  playingState: number;
};

/**
 * Listen-along: plays the YouTube upload of Spotify's current song and follows
 * Spotify to the next one until stopped.
 *
 * The sync is deliberately approximate. We start the video near where Spotify
 * is (estimated after the lookup finishes), and from then on the visitor
 * drives it: pausing or seeking on Spotify is not mirrored, only a change of
 * song is.
 *
 * Every request bumps `generation`, so anything still in flight for an earlier
 * request (match lookup, API load) is dropped when it resolves. Player events
 * are scoped by `playerEpoch`, which changes whenever a player is destroyed.
 */
export class ListenAlong {
  status: ListenStatus = "off";
  private deps: ListenAlongDeps;
  private generation = 0;
  private playerEpoch = 0;
  private player: PlayerLike | null = null;
  private ready = false;
  private following = false;
  private targetUrl: string | null = null;
  private disposed = false;

  constructor(deps: ListenAlongDeps) {
    this.deps = deps;
  }

  /** Visitor pressed "Listen with me": play `track` and keep following Spotify. */
  start(track: TrackRef) {
    this.following = true;
    return this.load(track);
  }

  /** Spotify moved on. Only acts while listening along. */
  follow(track: TrackRef) {
    if (!this.following || track.url === this.targetUrl) return;
    return this.load(track);
  }

  stop() {
    this.generation++;
    this.following = false;
    this.targetUrl = null;
    this.destroyPlayer();
    this.setStatus("off");
  }

  /** Terminal: invalidates pending work and silently tears the player down. */
  dispose() {
    this.disposed = true;
    this.generation++;
    this.following = false;
    this.destroyPlayer();
  }

  togglePause() {
    if (!this.player || !this.ready) return;
    if (this.player.getPlayerState() === this.deps.playingState)
      this.player.pauseVideo();
    else this.player.playVideo();
  }

  seek(seconds: number) {
    if (this.player && this.ready) this.player.seekTo(seconds, true);
  }

  playback() {
    if (!this.player || !this.ready) return null;
    const duration = this.player.getDuration();
    if (!duration) return null;
    return {
      position: this.player.getCurrentTime() * 1000,
      duration: duration * 1000,
      isPaused: this.player.getPlayerState() !== this.deps.playingState,
    };
  }

  private async load(track: TrackRef) {
    const generation = ++this.generation;
    const stale = () => generation !== this.generation;
    this.targetUrl = track.url;
    // The previous song would otherwise keep playing while we look up the next.
    if (this.ready) this.player?.pauseVideo();
    else this.destroyPlayer();
    this.setStatus("loading");

    let found;
    try {
      found = await this.deps.match();
    } catch {
      found = null;
    }
    if (stale()) return;
    const id = found?.url === track.url ? found.id : null;
    if (!id) return this.fail();

    try {
      await this.deps.loadApi();
    } catch {
      if (!stale()) this.fail();
      return;
    }
    if (stale()) return;

    const startAt = this.deps.startSeconds();
    if (this.player && this.ready) {
      this.player.loadVideoById({ videoId: id, startSeconds: startAt });
      this.setStatus("on");
      return;
    }

    // Any player still booting belongs to a superseded request.
    this.destroyPlayer();
    const epoch = this.playerEpoch;
    const current = () => epoch === this.playerEpoch && !this.disposed;
    this.player = this.deps.createPlayer(id, startAt, {
      onReady: () => {
        if (!current() || stale()) return;
        this.ready = true;
        this.player?.playVideo();
        this.setStatus("on");
      },
      onError: () => {
        if (!current()) return;
        // A ready player erroring while a newer request is loading is just the
        // old song failing; that request will report its own outcome.
        const superseded = this.ready && this.status === "loading";
        this.destroyPlayer();
        if (!superseded) this.setStatus("missing");
      },
    });
  }

  private fail() {
    this.destroyPlayer();
    this.setStatus("missing");
  }

  private destroyPlayer() {
    this.playerEpoch++;
    const player = this.player;
    this.player = null;
    this.ready = false;
    try {
      player?.destroy();
    } catch {
      // The iframe may already be gone.
    }
    this.deps.clearHost();
  }

  private setStatus(status: ListenStatus) {
    if (this.disposed || this.status === status) return;
    this.status = status;
    this.deps.onStatus(status);
  }
}
