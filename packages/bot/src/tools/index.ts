import { clearChannelTool } from "@discord-gpt/bot/src/tools/clear-channel";
import { channelInsightsTool } from "@discord-gpt/bot/src/tools/channel-insights";
import { fetchUrlTool } from "@discord-gpt/bot/src/tools/fetch-url";
import { internetSearchTool } from "@discord-gpt/bot/src/tools/internet-search";
import { listDirectoryTool } from "@discord-gpt/bot/src/tools/list-directory";
import { runCommandTool } from "@discord-gpt/bot/src/tools/run-command";
import { sendFileTool } from "@discord-gpt/bot/src/tools/send-file";

import type { Message } from "discord.js";

import type { Toolset } from "@discord-gpt/bot/src/tools/types";

const registeredTools = [ clearChannelTool, channelInsightsTool, fetchUrlTool, internetSearchTool, listDirectoryTool, runCommandTool, sendFileTool ];

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
