/**
 * Configuration loader for mcpGraph
 */

import { parseYamlConfig } from "./serializer.js";
import type { McpGraphConfig, ServerConfig, ServerConfigWithSource } from "../types/config.js";

/**
 * Load graph configuration, optionally merging mcpServers from an MCP JSON file
 * @param graphFilePath - Path to the YAML graph configuration file
 * @param mcpServersFromFile - Optional mcpServers loaded from an MCP JSON file
 * @returns McpGraphConfig with merged mcpServers (graph servers override mcp file servers)
 * Each server config is tagged with _source: 'graph' | 'external' to track origin
 */
export function loadConfig(
  graphFilePath: string,
  mcpServersFromFile?: Record<string, ServerConfig>
): McpGraphConfig {
  const config = parseYamlConfig(graphFilePath);

  // Tag servers from graph file with _source: 'graph'
  if (config.mcpServers) {
    for (const serverConfig of Object.values(config.mcpServers)) {
      serverConfig._source = 'graph';
    }
  }

  // Merge mcpServers: mcp file servers first, then graph servers (graph overrides)
  if (mcpServersFromFile) {
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Add external servers first (they'll be overridden by graph servers if names match)
    for (const [name, serverConfig] of Object.entries(mcpServersFromFile)) {
      if (!(name in config.mcpServers)) {
        config.mcpServers[name] = serverConfig;
        config.mcpServers[name]._source = 'external';
      }
    }
  }

  return config;
}

