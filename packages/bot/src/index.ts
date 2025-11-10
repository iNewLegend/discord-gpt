import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';

import { env } from './config/env';
import { registerAgentChannelHandler } from './listeners/agent-channel-handler';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

registerAgentChannelHandler(client);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖  Channel-aware agent ready as ${readyClient.user.tag}`);
});

client.on('error', (error) => {
  console.error('[discord] Client error', error);
});

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`Received ${signal}. Shutting down Discord client...`);
  await client.destroy();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.login(env.DISCORD_BOT_TOKEN);
