import { SpotifyWidget } from "./spotify-widget";
import { getSpotifyTrack } from "~/app/actions/spotify";

export default async function Spotify() {
  const initialTrack = await getSpotifyTrack();

  return <SpotifyWidget initialTrack={initialTrack} />;
}
