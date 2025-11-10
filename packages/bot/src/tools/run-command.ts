import { z } from "zod";

import type { AgentTool, JsonObject, ToolExecutionContext } from "@discord-gpt/bot/src/tools/types";

const schema: z.ZodType<JsonObject> = z.object( {
    command: z.string().min( 1 ).max( 1000 ),
    timeout: z.number().int().min( 1000 ).max( 60000 ).optional().default( 30000 )
} );

const jsonSchema = {
    type: "object",
    properties: {
        command: {
            type: "string",
            description: "The shell command to execute on the machine",
            minLength: 1,
            maxLength: 1000
        },
        timeout: {
            type: "integer",
            description: "Maximum execution time in milliseconds (1000-60000, default 30000)",
            minimum: 1000,
            maximum: 60000,
            default: 30000
        }
    },
    required: [ "command" ],
    additionalProperties: false
};

const COMMAND_TIMEOUT = 30000;

export const runCommandTool: AgentTool = {
    name: "run_command",
    description: "Executes a shell command on the machine and returns the output. Use this to run system commands, check file contents, list directories, or perform system operations.",
    schema,
    jsonSchema,
    canUse: () => true,
    execute: async ( context: ToolExecutionContext, input: JsonObject ): Promise<{ status: "success" | "error"; message: string }> => {
        const command = input.command as string;
        const timeout = Math.min( Math.max( ( input.timeout as number | undefined ) ?? COMMAND_TIMEOUT, 1000 ), 60000 );

        try {
            const result = await executeCommand( command, timeout );

            const payload: JsonObject = {
                command,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                timedOut: result.timedOut
            };

            return {
                status: "success",
                message: JSON.stringify( payload )
            };
        } catch ( error ) {
            const errorPayload: JsonObject = {
                error: error instanceof Error ? error.message : "Failed to execute command"
            };

            return {
                status: "error",
                message: JSON.stringify( errorPayload )
            };
        }
    }
};

async function executeCommand( command: string, timeout: number ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
}> {
    const controller = new AbortController();
    const timeoutId = setTimeout( () => controller.abort(), timeout );

    try {
        const proc = Bun.spawn( [ "sh", "-c", command ], {
            stdout: "pipe",
            stderr: "pipe",
            signal: controller.signal
        } );

        const [ stdout, stderr ] = await Promise.all( [
            new Response( proc.stdout ).text(),
            new Response( proc.stderr ).text()
        ] );

        const exitCode = await proc.exited;

        clearTimeout( timeoutId );

        return {
            exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            timedOut: false
        };
    } catch ( error ) {
        clearTimeout( timeoutId );

        if ( error instanceof Error && error.name === "AbortError" ) {
            return {
                exitCode: -1,
                stdout: "",
                stderr: `Command timed out after ${ timeout }ms`,
                timedOut: true
            };
        }

        throw error;
    }
}

