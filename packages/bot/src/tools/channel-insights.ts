import { ChannelType   } from "discord.js";

import { z } from "zod";

import type { GuildTextBasedChannel, ThreadChannel } from "discord.js";

import type { AgentTool, JsonObject, ToolExecutionContext } from "@discord-gpt/bot/src/tools/types";

const schema: z.ZodType<JsonObject> = z.object( {
    includeMembers: z.boolean().optional().default( false ),
    memberLimit: z.number().int().min( 1 ).max( 25 ).optional().default( 10 )
} );

const jsonSchema = {
    type: "object",
    properties: {
        includeMembers: {
            type: "boolean",
            description: "Include member display names who currently have access to the channel."
        },
        memberLimit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            description: "Maximum number of member names to list when includeMembers is true."
        }
    },
    additionalProperties: false
};

type MemberSnapshot = {
    total: number;
    sample: string[];
};

export const channelInsightsTool: AgentTool = {
    name: "describe_channel",
    description: "Summarizes metadata about the current channel and can list a limited set of member display names.",
    schema,
    jsonSchema,
    canUse: ( context: ToolExecutionContext ) => {
        if ( !context.message.inGuild() ) {
            return false;
        }

        return context.channel.isTextBased();
    },
    execute: async ( context: ToolExecutionContext, input: JsonObject ) => {
        if ( !context.message.inGuild() || !context.channel.isTextBased() ) {
            return {
                status: "error",
                message: "Channel is not available."
            };
        }

        const includeMembers = Boolean( ( input.includeMembers as boolean | undefined ) ?? false );
        const memberLimitRaw = ( input.memberLimit as number | undefined ) ?? 10;
        const memberLimit = Math.min( Math.max( memberLimitRaw, 1 ), 25 );

        const payload: JsonObject = {
            id: context.channel.id,
            name: getChannelName( context.channel ),
            type: getChannelTypeName( context.channel ),
            topic: getChannelTopic( context.channel ),
            nsfw: isNsfw( context.channel ),
            rateLimitSeconds: getRateLimit( context.channel ),
            parent: getParentName( context.channel ),
            createdAt: context.channel.createdAt?.toISOString() ?? null
        };

        if ( includeMembers ) {
            const snapshot = await collectMemberNames( context.channel, memberLimit );
            payload.memberCount = snapshot.total;
            payload.members = snapshot.sample;
        }

        return {
            status: "success",
            message: JSON.stringify( payload )
        };
    }
};

function getChannelName( channel: ToolExecutionContext[ "channel" ] ): string {
    if ( isThread( channel ) ) {
        return channel.name;
    }

    const typed = channel as GuildTextBasedChannel & { name?: string };
    if ( typed.name ) {
        return typed.name;
    }

    return channel.id;
}

function getChannelTypeName( channel: ToolExecutionContext[ "channel" ] ): string {
    const resolved = ChannelType[ channel.type ];

    if ( typeof resolved === "string" ) {
        return resolved;
    }

    return String( channel.type );
}

function getChannelTopic( channel: ToolExecutionContext[ "channel" ] ): string | null {
    if ( "topic" in channel && typeof channel.topic === "string" && channel.topic.length > 0 ) {
        return channel.topic;
    }

    return null;
}

function isNsfw( channel: ToolExecutionContext[ "channel" ] ): boolean {
    if ( "nsfw" in channel && typeof channel.nsfw === "boolean" ) {
        return channel.nsfw;
    }

    return false;
}

function getRateLimit( channel: ToolExecutionContext[ "channel" ] ): number | null {
    if ( "rateLimitPerUser" in channel && typeof channel.rateLimitPerUser === "number" ) {
        return channel.rateLimitPerUser;
    }

    return null;
}

function getParentName( channel: ToolExecutionContext[ "channel" ] ): string | null {
    if ( isThread( channel ) && channel.parent ) {
        return channel.parent.name ?? null;
    }

    if ( "parent" in channel && channel.parent && "name" in channel.parent && typeof channel.parent.name === "string" ) {
        return channel.parent.name;
    }

    return null;
}

async function collectMemberNames( channel: ToolExecutionContext[ "channel" ], limit: number ): Promise<MemberSnapshot> {
    if ( isThread( channel ) ) {
        await channel.members.fetch();
        const sample = channel.members.cache
            .map( ( threadMember ) => threadMember.member?.displayName ?? threadMember.id )
            .slice( 0, limit );
        return { total: channel.members.cache.size, sample };
    }

    const guildChannel = channel as GuildTextBasedChannel;
    const sample = guildChannel.members
        .map( ( member ) => member.displayName )
        .slice( 0, limit );
    return { total: guildChannel.members.size, sample };
}

function isThread( channel: ToolExecutionContext[ "channel" ] ): channel is ThreadChannel {
    return typeof ( channel as ThreadChannel ).isThread === "function" && ( channel as ThreadChannel ).isThread();
}
