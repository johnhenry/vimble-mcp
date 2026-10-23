#!/usr/bin/env node
import { z } from "zod";
import { runWithInjectedConsole as vimble } from '@johnhenry/vimble';
import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import pack from "./package.json" with { type: "json" };

// Parse command line arguments
const args = process.argv.slice(2);
const debug = args.includes('--debug');

// Helper functions for logging
const log = debug
  ? (...args) => console.error('[DEBUG]', ...args) 
  : () => {};

// Create an MCP server with more detailed information
const server = new McpServer({
  name: "Vimble Javascript Execution Server",
  version: pack.version,
  description: "Securely executes JavaScript code with optional context",
});

// Error handling utility
const handleError = (error) => {
  const message = error instanceof Error 
    ? error.message
    : String(error);
  
  log('Error:', message);

  return {
    content:[{ type: "text", text: `Error: ${message}`}],
    error: message,
    success: false
  }
};

// Add enhanced JavaScript execution tool
server.tool(
  "execute_javascript",
  `Execute JavaScript code.
  Use 'console.log' to get output.
  Use 'console.error' to show errors.`,
  {
    code: z.string().describe("JavaScript code to execute"), 
    context: z.object().optional().describe("Optional context to inject into the execution environment"),
    timeout: z.number().optional().describe("Timeout in milliseconds")
  },
  async ({ code, context, timeout } = {context: {}, timeout:10000}) => {
    try {
      log('Executing JavaScript code:', code.substring(0, 50) + (code.length > 50 ? '...' : ''));

      // Input validation
      if (!code || typeof code !== 'string') {
        throw new Error('Invalid code input: code must be a non-empty string');
      }

      // Execute the code with proper timeout and memory limits
      const result = await Promise.race([
        vimble(code, context, timeout),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Execution timed out (${timeout}ms limit)`)), timeout)
        )
      ]);
      log('Executing JavaScript code:', result.substring(0, 50) + (result.length > 50 ? '...' : ''));
      log('Execution completed successfully');

      return {
        content:[{ type: "text", text: result}],
        success: true
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

// Function to safely start the server with error handling
const startServer = async () => {
  try {
    // Start receiving messages on stdin and sending messages on stdout
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('Vimble JavaScript Execution Server started successfully');
    log(`Server version: ${pack.version}`);
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Handle unexpected errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Keep the process running despite the error
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  // Keep the process running despite the error
});
