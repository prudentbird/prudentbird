import { connection } from "next/server";
import { getLastFmHistory } from "~/app/actions/lastfm";

export async function GET() {
  await connection();
  try {
    return Response.json(await getLastFmHistory(), {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
