import { homedir } from "os";
import { readdir, stat } from "fs/promises";

import { z } from "zod";

import type { AgentTool, JsonObject, ToolExecutionContext } from "@discord-gpt/bot/src/tools/types";

const schema: z.ZodType<JsonObject> = z.object( {
    directoryPath: z.string().min( 1 ).max( 1000 )
} );

const jsonSchema = {
    type: "object",
    properties: {
        directoryPath: {
            type: "string",
            description: "The directory path to list contents (supports ~ for home directory)",
            minLength: 1,
            maxLength: 1000
        }
    },
    required: [ "directoryPath" ],
    additionalProperties: false
};

function expandPath( path: string ): string {
    if ( path.startsWith( "~/" ) || path === "~" ) {
        const home = homedir();
        return path.replace( "~", home );
    }

    return path;
}

type DirectoryEntry = {
    name: string;
    type: "file" | "directory";
    size?: number;
};

export const listDirectoryTool: AgentTool = {
    name: "list_directory",
    description: "Lists the contents of a directory, showing files and subdirectories with their types and sizes. Use this to explore the filesystem and find files before accessing them.",
    schema,
    jsonSchema,
    canUse: () => true,
    execute: async ( context: ToolExecutionContext, input: JsonObject ): Promise<{ status: "success" | "error"; message: string }> => {
        const rawPath = input.directoryPath as string;
        const expandedPath = expandPath( rawPath );

        try {
            const entries = await readdir( expandedPath );
            const entriesWithStats: DirectoryEntry[] = [];

            for ( const entry of entries ) {
                try {
                    const entryPath = `${ expandedPath }/${ entry }`;
                    const stats = await stat( entryPath );

                    if ( stats.isDirectory() ) {
                        entriesWithStats.push( {
                            name: entry,
                            type: "directory"
                        } );
                    } else {
                        entriesWithStats.push( {
                            name: entry,
                            type: "file",
                            size: stats.size
                        } );
                    }
                } catch {
                    entriesWithStats.push( {
                        name: entry,
                        type: "file"
                    } );
                }
            }

            entriesWithStats.sort( ( a, b ) => {
                if ( a.type !== b.type ) {
                    return a.type === "directory" ? -1 : 1;
                }
                return a.name.localeCompare( b.name );
            } );

            const payload: JsonObject = {
                directoryPath: rawPath,
                expandedPath,
                entries: entriesWithStats
            };

            return {
                status: "success",
                message: JSON.stringify( payload )
            };
        } catch ( error ) {
            const errorPayload: JsonObject = {
                error: error instanceof Error ? error.message : "Failed to list directory",
                directoryPath: rawPath,
                expandedPath
            };

            return {
                status: "error",
                message: JSON.stringify( errorPayload )
            };
        }
    }
};

