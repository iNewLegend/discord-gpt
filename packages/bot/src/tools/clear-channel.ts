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
            return {
                status: "error",
                message: "Channel does not support bulk deletion."
            };
        }

        try {
            const fetched = await context.channel.messages.fetch( { limit: MAX_DELETE } );
            const deletable = fetched.filter( ( msg ) => !msg.pinned && !msg.system );
            const deleted = await context.channel.bulkDelete( deletable, true );

            await context.channel.send( {
                content: `Cleared ${ deleted.size } messages as requested by ${ context.message.author.username }.`,
                allowedMentions: { parse: [] }
            } );

            return {
                status: "success",
                message: `Deleted ${ deleted.size } messages at ${ context.message.author.username }'s request.`
            };
        } catch {
            return {
                status: "error",
                message: "Failed to clear messages. Ensure they are newer than fourteen days."
            };
        }
    }
};

function isGuildTextChannel( channel: TextBasedChannel ): channel is GuildTextBasedChannel {
    return typeof ( channel as GuildTextBasedChannel ).bulkDelete === "function";
}
