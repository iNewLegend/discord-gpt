import { clearChannelTool } from "@discord-gpt/bot/src/tools/clear-channel";
import { channelInsightsTool } from "@discord-gpt/bot/src/tools/channel-insights";

import type { Message } from "discord.js";

import type { Toolset } from "@discord-gpt/bot/src/tools/types";

const registeredTools = [ clearChannelTool, channelInsightsTool ];

export function buildToolset( message: Message ): Toolset | undefined {
    if ( !message.channel.isTextBased() ) {
        return undefined;
    }

    const context = {
        message,
        channel: message.channel
    };

    const available = registeredTools.filter( ( tool ) => tool.canUse( context ) );

    if ( available.length === 0 ) {
        return undefined;
    }

    return {
        tools: available,
        context
    };
}
