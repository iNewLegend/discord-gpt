# discord-gpt — Channel-Aware GPT Relay

A Bun-powered Discord assistant that only responds when mentioned inside a guild channel. It listens to the latest ~20 channel messages, packages them into a short conversation window, and uses OpenAI to craft concise replies without pinging anyone.

## Prerequisites
- [Bun](https://bun.sh) v1.3+
- Discord bot with `Guilds`, `GuildMessages`, and `MessageContent` intents enabled
- OpenAI API key with access to `gpt-4o-mini` (or your preferred compatible model)

## Setup
1. Install dependencies:
   ```bash
   bun install
   ```
2. Copy `.env.sample` → `.env` and fill in your credentials:
   ```bash
   cp .env.sample .env
   ```
3. Run the bot locally (loads `packages/bot/src/index.ts`):
   ```bash
   bun dev
   ```

The Bun runtime automatically loads `.env` files; no extra config is needed.

## Commands
- `bun dev` / `bun start` – boots the Discord client and registers the channel-aware listener.
- `bun run lint` – runs ESLint across the workspace (mirrors the GitHub Actions lint workflow).
- `bun test` – placeholder for future listener/unit tests (Vitest or Bun test runner).
- `bun run typecheck` – strict TypeScript validation (recommended before pushing changes).

## How It Works
1. `packages/bot/src/index.ts` boots a `discord.js` client with the required intents.
2. `src/listeners/agent-channel-handler.ts` watches `messageCreate`, ignores bots, requires a direct mention, fetches ~20 recent messages, and shapes the chat history (`DisplayName: message`).
3. `src/utils/agent-client.ts` wraps the OpenAI client, adds the concise-response system prompt, trims long completions, and now exposes OpenAI tool-calling so the assistant can request privileged actions.
4. `src/tools/` registers server-side tools (starting with `clear_channel_messages` and `describe_channel`) that run permission checks and perform actions such as clearing recent messages or summarizing channel/member metadata when the model asks.

### Available Tools
- `clear_channel_messages` – Bulk deletes up to 50 recent, unpinned messages (14-day Discord limit) when both the moderator and bot have `ManageMessages`. Posts a confirmation message in-channel after completion.
- `describe_channel` – Returns JSON-formatted metadata (name, topic, type, rate limits, parent, creation timestamp) and can list up to 25 member display names currently in the channel.

Errors are surfaced back into the channel with mentions disabled so no one is accidentally pinged.
