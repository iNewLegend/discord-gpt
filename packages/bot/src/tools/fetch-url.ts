import { z } from "zod";

import type { AgentTool, JsonObject, ToolExecutionContext } from "@discord-gpt/bot/src/tools/types";

const schema: z.ZodType<JsonObject> = z.object( {
    url: z.string().url().min( 1 ).max( 2000 ),
    maxLength: z.number().int().min( 100 ).max( 50000 ).optional().default( 10000 )
} );

const jsonSchema = {
    type: "object",
    properties: {
        url: {
            type: "string",
            description: "The URL to fetch and read content from",
            format: "uri",
            minLength: 1,
            maxLength: 2000
        },
        maxLength: {
            type: "integer",
            description: "Maximum length of content to return in characters (100-50000, default 10000)",
            minimum: 100,
            maximum: 50000,
            default: 10000
        }
    },
    required: [ "url" ],
    additionalProperties: false
};

const REQUEST_TIMEOUT = 30000;

export const fetchUrlTool: AgentTool = {
    name: "fetch_url",
    description: "Fetches and reads the content from a URL. Use this to read web pages, API responses, or any URL content. Returns the raw text/HTML content.",
    schema,
    jsonSchema,
    canUse: () => true,
    execute: async ( context: ToolExecutionContext, input: JsonObject ): Promise<{ status: "success" | "error"; message: string }> => {
        const url = input.url as string;
        const maxLength = Math.min( Math.max( ( input.maxLength as number | undefined ) ?? 10000, 100 ), 50000 );

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout( () => controller.abort(), REQUEST_TIMEOUT );

            const response = await fetch( url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            } );

            clearTimeout( timeoutId );

            if ( !response.ok ) {
                const errorPayload: JsonObject = {
                    error: `HTTP ${ response.status }: ${ response.statusText }`,
                    url
                };

                return {
                    status: "error",
                    message: JSON.stringify( errorPayload )
                };
            }

            const contentType = response.headers.get( "content-type" ) ?? "";
            const isText = contentType.includes( "text/" ) ||
                contentType.includes( "application/json" ) ||
                contentType.includes( "application/xml" ) ||
                contentType.includes( "application/javascript" );

            if ( !isText ) {
                const errorPayload: JsonObject = {
                    error: `Content type "${ contentType }" is not text-based. Cannot read binary content.`,
                    url,
                    contentType
                };

                return {
                    status: "error",
                    message: JSON.stringify( errorPayload )
                };
            }

            let content = await response.text();

            if ( content.length > maxLength ) {
                content = content.substring( 0, maxLength ) + `\n\n[Content truncated: ${ content.length } total characters, showing first ${ maxLength }]`;
            }

            const payload: JsonObject = {
                url,
                contentType,
                contentLength: content.length,
                content,
                statusCode: response.status
            };

            return {
                status: "success",
                message: JSON.stringify( payload )
            };
        } catch ( error ) {
            if ( error instanceof Error && error.name === "AbortError" ) {
                const errorPayload: JsonObject = {
                    error: `Request timed out after ${ REQUEST_TIMEOUT }ms`,
                    url
                };

                return {
                    status: "error",
                    message: JSON.stringify( errorPayload )
                };
            }

            const errorPayload: JsonObject = {
                error: error instanceof Error ? error.message : "Failed to fetch URL",
                url
            };

            return {
                status: "error",
                message: JSON.stringify( errorPayload )
            };
        }
    }
};

