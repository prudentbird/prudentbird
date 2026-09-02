"use client";

import Link from "next/link";
import { authClient } from "~/lib/auth-client";
import { PlayerAvatar } from "~/components/player-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function SiteHeader() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const signOut = async () => {
    await authClient.signOut();
    // Hard navigation so every Convex subscription is torn down with the session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  };

  return (
    <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
      <Link href="/" className="font-medium tracking-tight">
        Sudoku
      </Link>
      <nav className="flex items-center gap-5">
        <Link
          href="/daily"
          className="text-sm text-muted-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Daily
        </Link>
        <Link
          href="/leaderboard"
          className="text-sm text-muted-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Leaderboard
        </Link>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account"
              >
                <PlayerAvatar name={user.name} image={user.image} size={26} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/stats">Stats</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </nav>
    </header>
  );
}
