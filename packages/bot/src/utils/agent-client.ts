import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { env } from '../config/env';

const BASE_SYSTEM_PROMPT = `You are a channel-aware assistant embedded directly inside Discord. Answer thoroughly yet succinctly, never prepend role labels, and rely on the provided channel history plus any metadata. If the conversation shows you were mentioned directly, respond in-channel; otherwise stay silent.`;

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

export type AgentChatMessage = Extract<ChatCompletionMessageParam, { role: 'user' | 'assistant' }>;

export type AgentContext = {
  isoTimestamp: string;
  timezone: string;
  localTime: string;
  guildName?: string;
  channelName?: string;
  triggeredBy?: string;
  botDisplayName?: string;
};

export async function runAgentChat(
  messages: AgentChatMessage[],
  context?: AgentContext
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(context)
      },
      ...messages
    ]
  });

  const rawContent = completion.choices[0]?.message?.content?.trim();

  return trimForDiscord(rawContent ?? 'I could not generate a response.');
}

function trimForDiscord(content: string): string {
  if (content.length <= env.MAX_DISCORD_REPLY_CHARS) {
    return content;
  }

  return `${content.slice(0, env.MAX_DISCORD_REPLY_CHARS - 1)}…`;
}

function buildSystemPrompt(context?: AgentContext): string {
  if (!context) {
    return BASE_SYSTEM_PROMPT;
  }

  const contextLines = [
    `Current ISO timestamp: ${context.isoTimestamp}`,
    `Local time (${context.timezone}): ${context.localTime}`,
    context.guildName ? `Guild: ${context.guildName}` : undefined,
    context.channelName ? `Channel: ${context.channelName}` : undefined,
    context.triggeredBy ? `Mentioned by: ${context.triggeredBy}` : undefined,
    context.botDisplayName ? `Assistant display name: ${context.botDisplayName}` : undefined
  ].filter((line): line is string => typeof line === 'string');

  return `${BASE_SYSTEM_PROMPT}\n\nContext metadata:\n${contextLines.join('\n')}\n\nWhen asked about the current date/time or channel, use the metadata above.`;
}
