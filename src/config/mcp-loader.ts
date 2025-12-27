/**
 * MCP JSON file loader for mcpGraph
 * Loads mcpServers from a standard MCP configuration JSON file
 */

import { readFileSync } from "node:fs";
import { z } from "zod";
import { logger } from "../logger.js";
import type { ServerConfig } from "../types/config.js";
import { serverConfigSchema } from "./schema.js";

// Schema for MCP JSON file structure
const mcpJsonFileSchema = z.object({
  mcpServers: z.record(serverConfigSchema).optional(),
});

/**
 * Load mcpServers from an MCP JSON configuration file
 * @param filePath - Path to the MCP JSON file (typically mcp.json)
 * @returns Record of server name to ServerConfig, or undefined if file doesn't exist or has no mcpServers
 * @throws Error if file exists but cannot be parsed or validated
 */
export function loadMcpServers(filePath: string): Record<string, ServerConfig> | undefined {
  try {
    logger.info(`Loading MCP servers from: ${filePath}`);
    const fileContents = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(fileContents) as unknown;

    // Validate file structure and server configs (all validated at once)
    const validated = mcpJsonFileSchema.parse(parsed);

    if (!validated.mcpServers || Object.keys(validated.mcpServers).length === 0) {
      logger.info(`No mcpServers found in ${filePath}`);
      return undefined;
    }

    // All servers are already validated by the schema, just cast to the correct type
    const servers = validated.mcpServers as Record<string, ServerConfig>;
    logger.info(`Loaded ${Object.keys(servers).length} MCP server(s) from ${filePath}`);
    return servers;
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a file not found error
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`MCP file not found: ${filePath}`);
      }
      logger.error(`Failed to load MCP file: ${error.message}`);
      throw error;
    }
    throw new Error("Unknown error loading MCP file");
  }
}

