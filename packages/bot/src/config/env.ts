import { z } from 'zod';

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_CHAT_MODEL: z.string().min(1).default('gpt-4o-mini'),
  MAX_DISCORD_REPLY_CHARS: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        return Number.parseInt(value, 10);
      }
      return undefined;
    },
    z.number().int().positive().max(2000).default(1900)
  )
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n[env] Configuration validation failed:\n');
  for (const issue of result.error.issues) {
    console.error(`- ${issue.message}`);
  }
  process.exit(1);
}

export const env = result.data;
