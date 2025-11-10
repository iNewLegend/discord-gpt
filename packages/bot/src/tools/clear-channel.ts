import { PermissionFlagsBits   } from "discord.js";

import { z } from "zod";

import type { GuildTextBasedChannel, TextBasedChannel } from "discord.js";

import type { AgentTool, JsonObject, ToolExecutionContext } from "@discord-gpt/bot/src/tools/types";

const schema: z.ZodType<JsonObject> = z.object( {} );

const jsonSchema = {
    type: "object",
    properties: {},
    additionalProperties: false
};

const MAX_DELETE = 50;

export const clearChannelTool: AgentTool = {
    name: "clear_channel_messages",
    description: "Clears up to fifty recent, unpinned messages in the current channel when moderators request a cleanup.",
    schema,
    jsonSchema,
    canUse: ( context: ToolExecutionContext ) => {
        if ( !context.message.inGuild() ) {
            return false;
        }

        if ( !isGuildTextChannel( context.channel ) ) {
            return false;
        }

        if ( !context.channel.isSendable() ) {
            return false;
        }

        const botPermissions = context.channel.permissionsFor( context.message.client.user );

        if ( !botPermissions?.has( PermissionFlagsBits.ManageMessages ) ) {
            return false;
        }

        const actorPermissions = context.message.member?.permissions;

        if ( !actorPermissions?.has( PermissionFlagsBits.ManageMessages ) ) {
            return false;
        }

        return true;
    },
    execute: async ( context: ToolExecutionContext ) => {
        if ( !isGuildTextChannel( context.channel ) ) {
            const errorPayload: JsonObject = {
                error: "Channel does not support bulk deletion."
            };

            return {
                status: "error",
                message: JSON.stringify( errorPayload )
            };
        }

        try {
            const fetched = await context.channel.messages.fetch( { limit: MAX_DELETE } );
            const deletable = fetched.filter( ( msg ) => !msg.pinned && !msg.system );
            const deleted = await context.channel.bulkDelete( deletable, true );

            const payload: JsonObject = {
                deletedCount: deleted.size,
                requestedBy: context.message.author.username,
                requestedByDisplayName: context.message.member?.displayName ?? context.message.author.globalName ?? context.message.author.username
            };

            return {
                status: "success",
                message: JSON.stringify( payload )
            };
        } catch {
            const errorPayload: JsonObject = {
                error: "Failed to clear messages. Ensure they are newer than fourteen days."
            };

            return {
                status: "error",
                message: JSON.stringify( errorPayload )
            };
        }
    }
};

function isGuildTextChannel( channel: TextBasedChannel ): channel is GuildTextBasedChannel {
    return typeof ( channel as GuildTextBasedChannel ).bulkDelete === "function";
}
