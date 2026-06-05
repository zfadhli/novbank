# Novbank — Agent Conventions

## Project

**Novbank** is a TypeScript library for downloading novels from
[freewebnovel.com](https://freewebnovel.com) and storing them in SQLite via
Drizzle ORM + libSQL. It is designed to be consumed by a CLI tool and a Hono
API server.

## Tech Stack

| Layer         | Choice                          |
| ------------- | ------------------------------- |
| Runtime       | Bun                             |
| Language      | TypeScript (strict)             |
| Type defs     | `bun-types` in `tsconfig.json`  |
| Database      | SQLite via `@libsql/client`     |
| ORM           | Drizzle ORM                     |
| HTTP          | Bun built-in `fetch`            |
| HTML parsing  | `node-html-parser`              |
| Testing       | `bun test` (built-in)           |
| Lint / Format | Biome                           |
| CI            | GitHub Actions                  |

## Commit Conventions

Use **emoji conventional commits**:

| Type       | Emoji | Example                                      |
| ---------- | ----- | -------------------------------------------- |
| feat       | ✨    | `✨ feat: add chapter range download`        |
| fix        | 🐛    | `🐛 fix: handle missing author field`        |
| refactor   | ♻️    | `♻️ refactor: extract parser helpers`        |
| docs       | 📚    | `📚 docs: add API usage examples`            |
| test       | 🧪    | `🧪 test: add parser edge cases`             |
| chore      | 🔧    | `🔧 chore: update biome config`              |
| style      | 💄    | `💄 style: format with 2-space indent`       |
| perf       | ⚡    | `⚡ perf: batch chapter inserts`             |

## Branch Naming

- `feature/<description>` — new functionality
- `fix/<description>` — bug fixes
- `chore/<description>` — maintenance, tooling, deps

Use kebab-case for descriptions (e.g. `feature/chapter-range-download`).

## Pre-commit Quality Gates

Before committing, run:

```bash
bun run typecheck   # TypeScript strict checking
bun run lint        # Biome lint + format check
bun test            # Full test suite
```

All three must pass. No exceptions.

## Git Safety Rules

- **No force push** (`git push --force`) — use `--force-with-lease` if
  absolutely necessary after a rebase.
- **No secrets** — never commit tokens, passwords, `.env` files, or database
  files containing real data.
- **No `--no-verify`** — pre-commit hooks (when configured) must always run.
- Commit messages must follow the emoji conventional commit format above.

## Knowledge Graph

This project uses **graphify** to maintain a persistent knowledge graph of the
codebase. The graph is stored at `graphify-out/graph.json`.

### Workflow

1. **Before** modifying source files, query the knowledge graph for context
   (types, relationships, existing patterns) instead of raw-dogging file reads.
2. **After** making changes and running `/git-commit`, automatically run
   `/git-graphify --update` to refresh the graph.
3. The graph includes "god nodes" for high-level concepts, community detection
   for module boundaries, and BFS/DFS query tools.

### Graph Commands

- Build / rebuild: `/git-graphify`
- Update after changes: `/git-graphify --update`
- Query: use BFS or DFS from a starting node in `graphify-out/graph.json`
