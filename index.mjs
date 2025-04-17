#!/usr/bin/env node
import { z } from "zod";
import { runWithInjectedConsole as vimble } from 'vimble';
import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";


import pack from "./package.json" with { type: "json" };

// Create an MCP server
const server = new McpServer({
  name: "Vimble Javascript Execution Server",
  version: pack.version,
});

// Add an addition tool
server.tool(
  "execute_javascript",
  { code: z.string(), context: z.object().optional() },
  async ({ code, context }= {context:{}}) => ({
    logs: await vimble(code, context)
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
