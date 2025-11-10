import { z } from "zod";

import type { AgentTool, JsonObject, ToolExecutionContext } from "@discord-gpt/bot/src/tools/types";

const schema: z.ZodType<JsonObject> = z.object( {
    query: z.string().min( 1 ).max( 500 ),
    maxResults: z.number().int().min( 1 ).max( 10 ).optional().default( 5 )
} );

const jsonSchema = {
    type: "object",
    properties: {
        query: {
            type: "string",
            description: "The search query to look up on the internet",
            minLength: 1,
            maxLength: 500
        },
        maxResults: {
            type: "integer",
            description: "Maximum number of search results to return (1-10)",
            minimum: 1,
            maximum: 10,
            default: 5
        }
    },
    required: [ "query" ],
    additionalProperties: false
};

type SearchResult = {
    title: string;
    url: string;
    snippet: string;
};

export const internetSearchTool: AgentTool = {
    name: "search_internet",
    description: "Searches the internet for current information, news, facts, or any topic. Use this when you need up-to-date information that may not be in your training data.",
    schema,
    jsonSchema,
    canUse: () => true,
    execute: async ( context: ToolExecutionContext, input: JsonObject ): Promise<{ status: "success" | "error"; message: string }> => {
        const query = input.query as string;
        const maxResults = Math.min( Math.max( ( input.maxResults as number | undefined ) ?? 5, 1 ), 10 );

        try {
            const results = await performSearch( query, maxResults );

            const payload: JsonObject = {
                query,
                results: results.map( ( result ) => ( {
                    title: result.title,
                    url: result.url,
                    snippet: result.snippet
                } ) )
            };

            return {
                status: "success",
                message: JSON.stringify( payload )
            };
        } catch ( error ) {
            const errorPayload: JsonObject = {
                error: error instanceof Error ? error.message : "Failed to perform internet search"
            };

            return {
                status: "error",
                message: JSON.stringify( errorPayload )
            };
        }
    }
};

async function performSearch( query: string, maxResults: number ): Promise<SearchResult[]> {
    const encodedQuery = encodeURIComponent( query );
    const url = `https://html.duckduckgo.com/html/?q=${ encodedQuery }`;

    const response = await fetch( url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
    } );

    if ( !response.ok ) {
        throw new Error( `Search request failed with status ${ response.status }` );
    }

    const html = await response.text();
    const results = parseDuckDuckGoResults( html, maxResults );

    return results;
}

function parseDuckDuckGoResults( html: string, maxResults: number ): SearchResult[] {
    const results: SearchResult[] = [];

    const resultBlocks = html.split( /<div[^>]*class="[^"]*result[^"]*"[^>]*>/i ).slice( 1 );

    for ( const block of resultBlocks.slice( 0, maxResults ) ) {
        const titleMatch = block.match( /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i );
        const snippetMatch = block.match( /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]+)<\/a>/i ) ||
            block.match( /<span[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]+)<\/span>/i );

        if ( titleMatch && titleMatch.length >= 3 ) {
            const url = decodeHtmlEntities( titleMatch[ 1 ] );
            const title = cleanHtml( titleMatch[ 2 ] );
            const snippet = snippetMatch && snippetMatch.length >= 2 ? cleanHtml( snippetMatch[ 1 ] ) : "";

            if ( title && url ) {
                results.push( {
                    title,
                    url,
                    snippet
                } );
            }
        }
    }

    return results;
}

function cleanHtml( text: string ): string {
    return text
        .replace( /<[^>]+>/g, "" )
        .replace( /&nbsp;/g, " " )
        .replace( /\s+/g, " " )
        .trim();
}

function decodeHtmlEntities( text: string ): string {
    return text
        .replace( /&amp;/g, "&" )
        .replace( /&lt;/g, "<" )
        .replace( /&gt;/g, ">" )
        .replace( /&quot;/g, '"' )
        .replace( /&#39;/g, "'" )
        .replace( /&apos;/g, "'" );
}

