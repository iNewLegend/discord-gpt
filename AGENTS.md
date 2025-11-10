# Repository Guidelines

## Project Structure & Module Organization
- `.cursor/rules/`: Repo-specific automation/convention rules. Read these before contributing to ensure Bun-first workflows and coding expectations stay consistent.
- `CHANGELOG.md`: Update this file with every merged change (keep entries grouped by release heading and date).
- `packages/bot/`: Discord bot entry point. Core listener lives in `src/listeners/agent-channel-handler.ts`, which subscribes to `messageCreate`, filters out bots, enforces mention-only triggers, and gathers the latest ~20 channel messages for context.
- `src/utils/agent-client.ts`: Shared OpenAI helper reused by listeners; handles client setup, output trimming, and prompt scaffolding.
- `src/config/env.ts`: Zod-powered validation for `DISCORD_BOT_TOKEN`, `OPENAI_API_KEY`, optional `OPENAI_CHAT_MODEL`, and `MAX_DISCORD_REPLY_CHARS`, keeping the bot channel-agnostic.
- `tests/`: Keep listener and helper specs mirrored to the source tree (e.g., `tests/listeners/agent-channel-handler.test.ts`).

## Build, Test, and Development Commands
- `bun install` — install workspace dependencies (set `BUN_INSTALL_CACHE_DIR=$PWD/.bun-cache` if temp access is restricted).
- `bun dev` / `bun start` — run the Discord bot (both target `packages/bot/src/index.ts`).
- `bun run typecheck` — strict TypeScript type-check; run before commits touching listeners/helpers.
- `bun test` — execute Bun/Vitest-style specs (add `--watch` during development once tests exist).

## Coding Style & Naming Conventions
- TypeScript strict mode; prefer explicit return types for exported helpers.
- 2-space indentation, single quotes, and trailing commas per prettier defaults.
- Listener files follow `*-handler.ts`; helpers use descriptive verbs (e.g., `runAgentChat`).
- Exported enums/interfaces are PascalCase; internal variables are camelCase; constants that mirror env vars remain UPPER_SNAKE_CASE.

## Testing Guidelines
- Use Vitest/Jest-style `describe`/`it` blocks; file names should mirror sources: `agent-channel-handler.test.ts`.
- Mock Discord.js clients and OpenAI responses to keep tests deterministic.
- Target >80% branch coverage for listener logic, especially mention filtering and error replies.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat: add agent listener`, `fix: trim long replies`). Keep subject ≤72 chars.
- Each PR must describe scope, mention related issue IDs, list validation commands run, and include screenshots or logs for user-visible behavior.
- Ensure `bun run typecheck && bun test` pass before requesting review; attach relevant `.env.sample` updates if new configuration is introduced.

## Security & Configuration Tips
- Never log raw API keys or bot tokens. Use redact helpers when debugging.
- Limit intents to `Guilds`, `GuildMessages`, and `MessageContent`; disable unused ones to minimize attack surface and honor Discord policies.
- Validate `.env` at startup (handled in `src/config/env.ts`) and fail fast when required variables are missing; keep `.env.sample` updated when adding knobs like `MAX_DISCORD_REPLY_CHARS`.
