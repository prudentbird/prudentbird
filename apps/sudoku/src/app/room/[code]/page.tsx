import type { Metadata } from "next";
import { Room } from "~/components/room/room";
import { normalizeCode } from "~/lib/utils";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Room ${normalizeCode(code)}`, robots: { index: false } };
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  return <Room code={normalizeCode(code)} />;
}
