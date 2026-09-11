# Sudoku

Multiplayer sudoku at sudoku.prudentbird.com. Next.js 16 + Convex (realtime
state) + Better Auth (Google sign-in via the Convex Better Auth component).

## Modes

- **Co-op** — one shared board; everyone's entries, colours and cursors are live.
- **Versus** — same puzzle, private boards, first to complete wins.

- **Daily challenge** — one shared puzzle per UTC day (difficulty rotates by
  weekday), solo, with a leaderboard by time then mistakes.

- **Rating** — every solve earns points (base by difficulty × speed vs par ×
  1.25 for no mistakes − 10% per hint; co-op splits by cells filled, versus
  pays the winner). Formula in `src/convex/lib/rating.ts`; rebuild all
  ratings after changing it with `npx convex run ratings:rebuild`.

- **Leaderboard** — all-time and this-week (since Monday 00:00 UTC) boards
  by points, each row showing solves, perfect solves and the player's fastest
  solve with its mode and difficulty. Every rated solve is logged to the
  persistent `solves` table (rooms are deleted after their TTL, so this is
  the durable history); `ratings:rebuild` backfills missing games and
  recalculates every row under the current formula without discarding
  existing ledger history. Solves older than 180 days are pruned daily.

## Analytics (PostHog)

Optional. Nothing is sent until `NEXT_PUBLIC_POSTHOG_KEY` (browser) and
`POSTHOG_KEY` (Convex) are set.

- **Browser** — [`@posthog/next`](https://posthog.com/docs/libraries/next-js)
  provider in `src/app/layout.tsx`, `/ingest` proxy in `src/proxy.ts`, server
  error capture in `src/instrumentation.ts`. `src/lib/analytics.ts` tracks
  pageviews, guest solo play (`is_guest: true`), sign-in/out and UI actions.
  Users are identified by their Convex user id after sign-in, which merges
  their guest events.
- **Convex** (`src/convex/analytics.ts`) — every signed-in game outcome, sent
  from mutations via a scheduled action so counts can't be spoofed.

| Event                 | Source  | Notes                                                   |
| --------------------- | ------- | ------------------------------------------------------- |
| `game_started`        | both    | `mode` solo/coop/versus/daily, `difficulty`, `is_guest` |
| `game_completed`      | both    | + `duration_ms`, `mistakes`, `hints`, `points`, `won`   |
| `game_abandoned`      | both    | new game / close / rematch while a board was in play    |
| `hint_used`           | both    |                                                         |
| `room_created`        | server  | `mode`, `difficulty`, `room_id`                         |
| `room_joined`         | server  | new members only, `player_count`                        |
| `room_finished`       | server  | once per round, on the host                             |
| `room_rematched`      | server  |                                                         |
| `room_closed`         | server  | `reason` host/inactivity                                |
| `guest_games_synced`  | server  | `count`                                                 |
| `sign_in_clicked`     | browser | `callback_url`                                          |
| `signed_out`          | browser |                                                         |
| `invite_link_copied`  | browser |                                                         |
| `daily_result_shared` | browser | `method` share/clipboard                                |
| `room_join_submitted` | browser |                                                         |
| `theme_toggled`       | browser |                                                         |

Games played = `game_completed` (or `game_started`) filtered by `mode`; for
multiplayer rounds count unique `room_id` + `round`, or use `room_finished`.

Puzzles are generated server-side with a unique-solution check. The solution
never leaves Convex: clients receive the list of wrong cells instead. Hints
(co-op and daily only) are also resolved server-side.

## Local development

```bash
cp apps/sudoku/.env.example apps/sudoku/.env.local
pnpm --filter sudoku dev:convex   # first run: creates the Convex project, fills CONVEX_DEPLOYMENT and prints URLs
pnpm --filter sudoku dev          # Next on http://localhost:3000
```

Set the Convex-side env (once per deployment):

```bash
cd apps/sudoku
npx convex env set SITE_URL http://localhost:3000
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set GOOGLE_CLIENT_ID ...
npx convex env set GOOGLE_CLIENT_SECRET ...
npx convex env set POSTHOG_KEY phc_...   # optional
```

Google OAuth authorised redirect URI: `<SITE_URL>/api/auth/callback/google` (the Next
`/api/auth` route proxies to Convex, so the Convex site URL is not registered with Google).

## Deploy (Vercel)

- Root directory: `apps/sudoku`
- Build command: `npx convex deploy --cmd 'pnpm build'`
- Env: `CONVEX_DEPLOY_KEY` (production deploy key), `SITE_URL`,
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`,
  and optionally `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`
- Set the same Convex-side env on the production deployment with
  `npx convex env set --prod ...`, using the production URLs.
