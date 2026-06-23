# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`prudentbird.com` this is the personal portfolio site of Prudent Bird (Daniel Wari),
an AI & Software Engineer. It is a single-page Next.js site.

## Stack

- Next.js (App Router) + React 19, TypeScript
- Tailwind CSS, shadcn/ui (Radix primitives)
- pnpm + Turborepo
- Deployed on Vercel

## Commands

- `pnpm dev` — start the dev server
- `pnpm build` — production build (via turbo)
- `pnpm lint` — ESLint
- `pnpm typecheck` — type checking
- `pnpm format` — Prettier

Run `pnpm lint` and `pnpm typecheck` before considering a change done.

## Conventions

- Server components by default; add `"use client"` only when needed.
- Match the surrounding code style; the project uses Prettier — don't hand-format.
- Environment variables are validated in `src/env.ts` (t3-env). Add new vars there.
- Static agent-facing files (`llms.txt`, `llms-full.txt`, `index.md`) live in `public/`.

## Layout

- `src/lib/` — utilities
- `src/components/` — UI components
- `public/` — static assets and agent discovery files
- `src/app/` — routes, layout, metadata, robots, sitemap
