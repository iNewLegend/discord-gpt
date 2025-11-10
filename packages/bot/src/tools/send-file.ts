import { AttachmentBuilder } from "discord.js";
import { homedir } from "os";

import { z } from "zod";

import type { AgentTool, JsonObject, ToolExecutionContext } from "@discord-gpt/bot/src/tools/types";

const schema: z.ZodType<JsonObject> = z.object( {
    filePath: z.string().min( 1 ).max( 1000 ),
    message: z.string().max( 2000 ).optional()
} );

const jsonSchema = {
    type: "object",
    properties: {
        filePath: {
            type: "string",
            description: "The local file path to send (relative or absolute path)",
            minLength: 1,
            maxLength: 1000
        },
        message: {
            type: "string",
            description: "Optional message to include with the file (max 2000 characters)",
            maxLength: 2000
        }
    },
    required: [ "filePath" ],
    additionalProperties: false
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function expandPath( path: string ): string {
    if ( path.startsWith( "~/" ) || path === "~" ) {
        const home = homedir();
        return path.replace( "~", home );
    }

    return path;
}

export const sendFileTool: AgentTool = {
    name: "send_file",
    description: "Sends a file from the local filesystem to the Discord channel. Use this to share files, logs, images, or any local files with users.",
    schema,
    jsonSchema,
    canUse: ( context: ToolExecutionContext ) => {
        if ( !context.channel.isTextBased() ) {
            return false;
        }

        return context.channel.isSendable();
    },
    execute: async ( context: ToolExecutionContext, input: JsonObject ): Promise<{ status: "success" | "error"; message: string }> => {
        const rawFilePath = input.filePath as string;
        const expandedFilePath = expandPath( rawFilePath );
        const message = ( input.message as string | undefined ) ?? "";

        try {
            const file = Bun.file( expandedFilePath );

            if ( !await file.exists() ) {
                const errorPayload: JsonObject = {
                    error: `File not found: ${ rawFilePath } (expanded: ${ expandedFilePath })`
                };

                return {
                    status: "error",
                    message: JSON.stringify( errorPayload )
                };
            }

            const fileSize = file.size;

            if ( fileSize > MAX_FILE_SIZE ) {
                const errorPayload: JsonObject = {
                    error: `File too large: ${ fileSize } bytes (max ${ MAX_FILE_SIZE } bytes)`
                };

                return {
                    status: "error",
                    message: JSON.stringify( errorPayload )
                };
            }

            const fileName = expandedFilePath.split( /[/\\]/ ).pop() ?? "file";
            const fileBuffer = await file.arrayBuffer();

            const attachment = new AttachmentBuilder( Buffer.from( fileBuffer ), {
                name: fileName
            } );

            await context.channel.send( {
                content: message || undefined,
                files: [ attachment ],
                allowedMentions: { parse: [] }
            } );

            const payload: JsonObject = {
                filePath: rawFilePath,
                fileName,
                fileSize,
                message: message || null
            };

            return {
                status: "success",
                message: JSON.stringify( payload )
            };
        } catch ( error ) {
            const errorPayload: JsonObject = {
                error: error instanceof Error ? error.message : "Failed to send file"
            };

            return {
                status: "error",
                message: JSON.stringify( errorPayload )
            };
        }
    }
};

