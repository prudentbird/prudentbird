# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

A pnpm + Turborepo monorepo for Prudent Bird's (Daniel Wari) web apps:

- `apps/web` — `prudentbird.com`, the personal portfolio (single-page Next.js site).
- `apps/sudoku` — `sudoku.prudentbird.com`, a realtime multiplayer sudoku game
  (Next.js + Convex + Better Auth with Google sign-in). See `apps/sudoku/README.md`.

## Stack

- Next.js (App Router) + React 19, TypeScript
- Tailwind CSS v4, shadcn/ui (Radix primitives)
- Convex for realtime data (sudoku only), Better Auth via `@convex-dev/better-auth`
- pnpm workspaces + Turborepo
- Deployed on Vercel (one Vercel project per app; set Root Directory accordingly)

## Commands (run from the repo root)

- `pnpm dev` — start every app's dev server; `pnpm dev:web`, `pnpm dev:sudoku`
  (the sudoku one also runs `convex dev`)
- `pnpm build` — production build of all apps (via turbo)
- `pnpm lint` / `pnpm typecheck` / `pnpm format`
- Target one app with `pnpm --filter <web|sudoku> <script>`

Run `pnpm lint` and `pnpm typecheck` before considering a change done.

## Conventions

- Server components by default; add `"use client"` only when needed.
- Match the surrounding code style; the project uses Prettier — don't hand-format.
- Environment variables are validated in each app's `src/env.ts` (t3-env). Add new vars
  there and to the `env` list in `turbo.json` if the build needs them.
- `apps/web/public/` holds static agent-facing files (`llms.txt`, `llms-full.txt`, `index.md`).
- `apps/sudoku/src/convex/` holds Convex functions; `_generated/` is written by
  `convex dev`/`convex codegen` and must not be hand-edited once a deployment exists.
- The sudoku solution string must never be returned from a Convex query.

## Layout (per app)

- `src/lib/` — utilities
- `src/components/` — UI components
- `src/app/` — routes, layout, metadata
- `public/` — static assets
