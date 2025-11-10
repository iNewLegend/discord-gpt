import OpenAI from "openai";

import { env } from "@discord-gpt/bot/src/config/env";
import { toOpenAITool } from "@discord-gpt/bot/src/tools/types";

import type { Toolset, JsonValue } from "@discord-gpt/bot/src/tools/types";

import type {
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionMessageToolCall,
    ChatCompletionTool
} from "openai/resources/chat/completions";

const BASE_SYSTEM_PROMPT = "You are a channel-aware assistant embedded directly inside Discord. Answer thoroughly yet succinctly, never prepend role labels, and rely on the provided channel history plus any metadata. Always respond in the same language as the user's request. If the conversation shows you were mentioned directly, respond in-channel; otherwise stay silent.";

const openai = new OpenAI( {
    apiKey: env.OPENAI_API_KEY
} );

export type AgentChatMessage = Extract<ChatCompletionMessageParam, { role: "user" | "assistant" }>

export type AgentContext = {
    isoTimestamp: string
    timezone: string
    localTime: string
    guildName?: string
    channelName?: string
    triggeredBy?: string
    botDisplayName?: string
}

type RunAgentChatOptions = {
    context?: AgentContext
    toolset?: Toolset
}

type JsonObject = { [key: string]: JsonValue }

export async function runAgentChat(
    messages: AgentChatMessage[],
    options?: RunAgentChatOptions
): Promise<string> {
    const conversation: ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: buildSystemPrompt( options?.context )
        },
        ...messages
    ];

    const openAiTools = options?.toolset?.tools.map( ( tool ) => toOpenAITool( tool ) );

    return executeChatLoop( conversation, openAiTools, options?.toolset );
}

async function executeChatLoop(
    conversation: ChatCompletionMessageParam[],
    openAiTools?: ChatCompletionTool[],
    toolset?: Toolset
): Promise<string> {
    let currentMessages = conversation;

    while ( true ) {
        const completion = await openai.chat.completions.create( {
            model: env.OPENAI_CHAT_MODEL,
            temperature: 0.3,
            messages: currentMessages,
            tools: openAiTools,
            tool_choice: openAiTools && openAiTools.length > 0 ? "auto" : undefined
        } );

        const choice = completion.choices[ 0 ];

        if ( !choice || !choice.message ) {
            return "I could not generate a response.";
        }

        const toolCall = choice.message.tool_calls?.[ 0 ];

        if ( toolCall && toolset && toolset.tools.length > 0 ) {
            const updatedMessages = await handleToolCall( currentMessages, choice.message, toolCall, toolset );

            if ( !updatedMessages ) {
                return "I could not generate a response.";
            }

            currentMessages = updatedMessages;
            continue;
        }

        const rawContent = choice.message.content?.trim();

        return trimForDiscord( rawContent ?? "I could not generate a response." );
    }
}

async function handleToolCall(
    currentMessages: ChatCompletionMessageParam[],
    assistantMessage: ChatCompletionMessageParam,
    toolCall: ChatCompletionMessageToolCall,
    toolset: Toolset
): Promise<ChatCompletionMessageParam[] | undefined> {
    const tool = toolset.tools.find( ( candidate ) => candidate.name === toolCall.function.name );

    if ( !tool ) {
        return undefined;
    }

    const parsedArguments = parseArguments( toolCall.function.arguments ?? "{}" );

    let validatedArgs: JsonObject;

    try {
        validatedArgs = tool.schema.parse( parsedArguments );
    } catch {
        return undefined;
    }

    const result = await tool.execute( toolset.context, validatedArgs );

    const assistantSource = assistantMessage as ChatCompletionAssistantMessageParam;

    const assistantRecord: ChatCompletionAssistantMessageParam = {
        role: "assistant",
        content: normalizeAssistantContent( assistantMessage.content ),
        tool_calls: assistantSource.tool_calls
    };

    return [
        ...currentMessages,
        assistantRecord,
        {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify( result )
        }
    ];
}

function parseArguments( payload: string ): JsonObject {
    try {
        const parsed = JSON.parse( payload ) as JsonValue;

        if ( typeof parsed === "object" && parsed !== null && !Array.isArray( parsed ) ) {
            return parsed as JsonObject;
        }

        return {};
    } catch {
        return {};
    }
}

function normalizeAssistantContent(
    content: ChatCompletionMessageParam["content"]
): string | null | undefined {
    if ( typeof content === "string" || typeof content === "undefined" || content === null ) {
        return content;
    }

    return JSON.stringify( content );
}

function trimForDiscord( content: string ): string {
    if ( content.length <= env.MAX_DISCORD_REPLY_CHARS ) {
        return content;
    }

    return `${ content.slice( 0, env.MAX_DISCORD_REPLY_CHARS - 1 ) }…`;
}

function buildSystemPrompt( context?: AgentContext ): string {
    if ( !context ) {
        return BASE_SYSTEM_PROMPT;
    }

    const contextLines = [
        `Current ISO timestamp: ${ context.isoTimestamp }`,
        `Local time (${ context.timezone }): ${ context.localTime }`,
        context.guildName ? `Guild: ${ context.guildName }` : undefined,
        context.channelName ? `Channel: ${ context.channelName }` : undefined,
        context.triggeredBy ? `Mentioned by: ${ context.triggeredBy }` : undefined,
        context.botDisplayName ? `Assistant display name: ${ context.botDisplayName }` : undefined
    ].filter( ( line ): line is string => typeof line === "string" );

    return `${ BASE_SYSTEM_PROMPT }\n\nContext metadata:\n${ contextLines.join( "\n" ) }\n\nWhen asked about the current date/time or channel, use the metadata above.`;
}
