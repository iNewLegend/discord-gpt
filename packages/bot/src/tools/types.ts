import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { z } from "zod";
import type { Message, TextBasedChannel } from "discord.js";

export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

export type JsonObject = { [key: string]: JsonValue }

export type ToolExecutionContext = {
    message: Message
    channel: TextBasedChannel
}

export type ToolExecutionResult = {
    status: "success" | "error"
    message: string
}

export type AgentTool = {
    name: string
    description: string
    schema: z.ZodType<JsonObject>
    jsonSchema: { [key: string]: JsonValue }
    canUse: ( context: ToolExecutionContext ) => boolean
    execute: ( context: ToolExecutionContext, input: JsonObject ) => Promise<ToolExecutionResult>
}

export type Toolset = {
    tools: AgentTool[]
    context: ToolExecutionContext
}

export function toOpenAITool( tool: AgentTool ): ChatCompletionTool {
    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.jsonSchema
        }
    };
}
