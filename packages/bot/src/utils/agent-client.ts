import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { env } from '../config/env';

const SYSTEM_PROMPT = `You are a channel-aware assistant embedded directly inside Discord. Answer concisely (2-4 sentences), never prepend role labels, and rely solely on the provided channel history. If the request does not mention you directly, do not respond.`;

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

export type AgentChatMessage = Extract<ChatCompletionMessageParam, { role: 'user' | 'assistant' }>;

export async function runAgentChat(messages: AgentChatMessage[]): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
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
