import { connection } from "next/server";
import { getSpotifySnapshot } from "~/app/actions/spotify";

export async function GET() {
  await connection();
  try {
    return Response.json(await getSpotifySnapshot(), {
      headers: { "Cache-Control": "public, s-maxage=8" },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
