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
