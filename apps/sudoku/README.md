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
```

Google OAuth authorised redirect URI: `<SITE_URL>/api/auth/callback/google` (the Next
`/api/auth` route proxies to Convex, so the Convex site URL is not registered with Google).

## Deploy (Vercel)

- Root directory: `apps/sudoku`
- Build command: `npx convex deploy --cmd 'pnpm build:app'`
- Env: `CONVEX_DEPLOY_KEY` (production deploy key), `SITE_URL`,
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`
- Set the same Convex-side env on the production deployment with
  `npx convex env set --prod ...`, using the production URLs.
