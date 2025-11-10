import {

    Events

} from "discord.js";

import {
    runAgentChat

} from "@discord-gpt/bot/src/utils/agent-client";

import type { Client, Message, TextBasedChannel, ThreadChannel } from "discord.js";

import type { AgentChatMessage, AgentContext } from "@discord-gpt/bot/src/utils/agent-client";

const CONTEXT_MESSAGE_LIMIT = 20;

export function registerAgentChannelHandler( client: Client ): void {
    client.on( Events.MessageCreate, async ( message ) => {
        if ( !shouldHandleMessage( message ) ) {
            return;
        }

        try {
            const conversation = await buildConversationHistory( message );

            if ( conversation.length === 0 ) {
                return;
            }

            const reply = await runAgentChat( conversation, buildAgentContext( message ) );

            await message.reply( {
                content: reply,
                allowedMentions: { parse: [] }
            } );
        } catch ( error ) {
            console.error( "[agent-channel-handler] Failed to respond to mention", error );

            await safeReply( message, "I ran into an error while replying — please try again in a moment." );
        }
    } );
}

function shouldHandleMessage( message: Message ): boolean {
    if ( !message.inGuild() ) return false;
    if ( !message.channel.isTextBased() ) return false;
    if ( !message.channel.isSendable() ) return false;
    if ( message.author.bot ) return false;

    const botUser = message.client.user;
    if ( !botUser ) return false;

    const mentioned = message.mentions.has( botUser, {
        ignoreEveryone: true,
        ignoreRoles: true,
        ignoreRepliedUser: true
    } );

    return mentioned;
}

async function buildConversationHistory( message: Message ): Promise<AgentChatMessage[]> {
    const botUser = message.client.user;
    if ( !botUser ) return [];

    const channel = message.channel as TextBasedChannel;

    const fetched = await channel.messages.fetch( { limit: CONTEXT_MESSAGE_LIMIT } );
    const sorted = [ ...fetched.values() ].sort( ( a, b ) => a.createdTimestamp - b.createdTimestamp );

    const conversation: AgentChatMessage[] = [];

    for ( const msg of sorted ) {
        const content = formatMessageContent(
            msg,
            botUser.username,
            msg.guild?.members.me?.displayName
        );
        if ( !content ) continue;

        if ( msg.author.id === botUser.id ) {
            conversation.push( { role: "assistant", content } );
        } else {
            conversation.push( {
                role: "user",
                content: `${ getDisplayName( msg ) }: ${ content }`
            } );
        }
    }

    return conversation;
}

function buildAgentContext( message: Message ): AgentContext {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    const localTime = now.toLocaleString( "en-US", {
        timeZone: timezone,
        dateStyle: "full",
        timeStyle: "long"
    } );

    return {
        isoTimestamp: now.toISOString(),
        timezone,
        localTime,
        guildName: message.guild?.name,
        channelName: resolveChannelName( message.channel as TextBasedChannel ),
        triggeredBy: getDisplayName( message ),
        botDisplayName: message.guild?.members.me?.displayName ?? message.client.user?.username
    };
}

function formatMessageContent( message: Message, botUsername: string, botDisplayName?: string | null ): string {
    const mentionLabels = new Set<string>();
    mentionLabels.add( `@${ botUsername }` );

    if ( botDisplayName && botDisplayName.trim().length > 0 ) {
        mentionLabels.add( `@${ botDisplayName }` );
    }

    let clean = ( message.cleanContent ?? "" ).trim();
    if ( clean.length > 0 ) {
        mentionLabels.forEach( ( label ) => {
            clean = clean.replaceAll( new RegExp( escapeRegex( label ), "gi" ), "" ).trim();
        } );
    }

    if ( clean.length === 0 && message.attachments.size > 0 ) {
        clean = Array.from( message.attachments.values() )
            .map( ( attachment ) => `[attachment: ${ attachment.name ?? "file" }]` )
            .join( ", " );
    }

    return clean;
}

function getDisplayName( message: Message ): string {
    return message.member?.displayName ?? message.author.globalName ?? message.author.username;
}

function resolveChannelName( channel: TextBasedChannel ): string {
    const threadChannel = channel as ThreadChannel;
    if ( typeof threadChannel.isThread === "function" && threadChannel.isThread() ) {
        const parentName = threadChannel.parent?.name;
        return parentName ? `${ parentName } › ${ threadChannel.name }` : threadChannel.name;
    }

    const namedChannel = channel as { name?: string | null };
    if ( namedChannel.name ) {
        return namedChannel.name;
    }

    return channel.id;
}

async function safeReply( message: Message, content: string ): Promise<void> {
    if ( !message.channel.isSendable() ) return;

    await message.reply( {
        content,
        allowedMentions: { parse: [] }
    } );
}

function escapeRegex( value: string ): string {
    return value.replace( /[.*+?^${}()|[\]\\]/g, "\\$&" );
}
