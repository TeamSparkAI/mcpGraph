/**
 * Configuration loader for mcpGraph
 */

import { parseYamlConfig } from "./parser.js";
import type { McpGraphConfig, ServerConfig } from "../types/config.js";

/**
 * Load graph configuration, optionally merging mcpServers from an MCP JSON file
 * @param graphFilePath - Path to the YAML graph configuration file
 * @param mcpServersFromFile - Optional mcpServers loaded from an MCP JSON file
 * @returns McpGraphConfig with merged mcpServers (graph servers override mcp file servers)
 */
export function loadConfig(
  graphFilePath: string,
  mcpServersFromFile?: Record<string, ServerConfig>
): McpGraphConfig {
  const config = parseYamlConfig(graphFilePath);

  // Merge mcpServers: mcp file servers first, then graph servers (graph overrides)
  if (mcpServersFromFile) {
    config.mcpServers = {
      ...mcpServersFromFile,
      ...(config.mcpServers || {}),
    };
  }

  return config;
}

