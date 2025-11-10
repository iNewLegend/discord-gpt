# 2025-11-10

### Added
- `send_file` tool shares local files (with size/path validation) straight into the channel when the model needs to deliver artifacts.
- `run_command` tool executes shell commands with timeout enforcement and streams stdout/stderr back into the reply payloads.
- `search_internet` tool performs DuckDuckGo lookups so the agent can cite up-to-date information.
- Typing indicator and tool completion confirmations to show users when the bot is working or has finished tasks.

### Changed
- Agent messages now always start with the `thinking` prefix and provide clearer error feedback if replying fails.
- Prompt packaging enriches every completion with timestamps, channel metadata, and tool-call results for better model context.
- ESLint configuration, lint/typecheck workflows, and package-level dependency reshuffles keep the Bun workspace consistent.

### Documentation
- `AGENTS.md` outlines the enforced linting style plus Cursor commit message template so contributors match the automation rules.
- README documents the expanded toolset and CI commands for linting and type checking.

# 2025-11-10

### Added
- OpenAI tool-calling workflow with a `clear_channel_messages` tool so the bot can execute moderator requests like clearing recent messages when prompted.
- `describe_channel` tool that summarizes channel metadata (name, type, topic, rate limits, parent) and can list up to 25 member display names on demand.
- Workspace lint script plus dedicated GitHub Actions workflows for linting and type-checking.

### Changed
- Channel cleanup now posts an in-channel confirmation after deleting messages so moderators see immediate feedback.

# 2025-11-10

### Added
- Initial Bun-based channel-aware Discord bot bootstrap.
- OpenAI helper, env validation, and mention-triggered listener.
- Documentation (.env.sample, README, AGENTS) and assets.
