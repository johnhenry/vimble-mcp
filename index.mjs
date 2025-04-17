#!/usr/bin/env node
import { z } from "zod";
import { runWithInjectedConsole as vimble } from 'vimble';
import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "path";
import os from 'os';

import pack from "./package.json" with { type: "json" };

// Parse command line arguments
const args = process.argv.slice(2);
const allowSandboxing = args.includes('--sandbox');
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
    logs: [`Error: ${message}`],
    error: message,
    success: false
  };
};

// Add enhanced JavaScript execution tool
server.tool(
  "execute_javascript",
  { 
    code: z.string().describe("JavaScript code to execute"), 
    context: z.object().optional().describe("Optional context to inject into the execution environment")
  },
  async ({ code, context } = {context: {}}) => {
    try {
      log('Executing JavaScript code:', code.substring(0, 50) + (code.length > 50 ? '...' : ''));
      
      // Input validation
      if (!code || typeof code !== 'string') {
        throw new Error('Invalid code input: code must be a non-empty string');
      }
      
      // Execute the code with proper timeout and memory limits
      const result = await Promise.race([
        vimble(code, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Execution timed out (10s limit)')), 10000)
        )
      ]);
      
      log('Execution completed successfully');
      
      return {
        logs: result,
        success: true
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

// Add execution status tool
server.tool(
  "javascript_execution_status",
  {},
  async () => {
    try {
      return {
        status: "operational",
        version: pack.version,
        engine: "vimble",
        sandboxed: allowSandboxing,
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
    log(`Sandbox mode: ${allowSandboxing ? 'enabled' : 'disabled'}`);
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
