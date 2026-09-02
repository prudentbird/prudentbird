# prudentbird

Monorepo for [prudentbird.com](https://prudentbird.com) and side projects.

| App            | Path          | URL                            |
| -------------- | ------------- | ------------------------------ |
| Portfolio      | `apps/web`    | https://prudentbird.com        |
| Sudoku (multi) | `apps/sudoku` | https://sudoku.prudentbird.com |

## Getting started

```bash
pnpm install
pnpm dev:web      # portfolio on :3000
pnpm dev:sudoku   # sudoku on :3000 + convex dev (same port as web, run one at a time)
```

See `AGENTS.md` for conventions and `apps/sudoku/README.md` for the sudoku
setup (Convex + Google OAuth).
