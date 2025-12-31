/**
 * YAML serializer for mcpGraph configuration
 * Handles both deserialization (load/parse) and serialization (save/dump)
 */

import { load, dump } from "js-yaml";
import { readFileSync, writeFileSync } from "node:fs";
import { mcpGraphConfigSchema } from "./schema.js";
import type { McpGraphConfig } from "../types/config.js";
import { logger } from "../logger.js";
import { validateConfigExpressions } from "./expression-validator.js";

/**
 * Parse YAML configuration file into McpGraphConfig object
 * @param filePath - Path to the YAML configuration file
 * @returns McpGraphConfig object
 */
export function parseYamlConfig(filePath: string): McpGraphConfig {
  try {
    const fileContents = readFileSync(filePath, "utf-8");
    const parsed = load(fileContents) as unknown;

    // Validate against schema
    const validated = mcpGraphConfigSchema.parse(parsed);

    // Validate expression syntax (JSONata and JSON Logic)
    const expressionErrors = validateConfigExpressions(validated as McpGraphConfig);
    if (expressionErrors.length > 0) {
      const errorMessages = expressionErrors.map(
        (e) => `  - Node "${e.nodeId}": ${e.message}`
      ).join("\n");
      const error = new Error(
        `Configuration validation failed - expression syntax errors:\n${errorMessages}`
      );
      logger.error(error.message);
      throw error;
    }

    return validated as McpGraphConfig;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to parse YAML config: ${error.message}`);
      throw error;
    }
    throw new Error("Unknown error parsing YAML config");
  }
}

/**
 * Write McpGraphConfig object to YAML file
 * @param filePath - Path to the YAML configuration file
 * @param config - McpGraphConfig object to write
 * Only servers with _source: 'graph' are serialized (external servers are excluded)
 */
export function writeYamlConfig(filePath: string, config: McpGraphConfig): void {
  try {
    // Create a copy for serialization, filtering out external servers
    const configToWrite: McpGraphConfig = {
      ...config,
      mcpServers: undefined,
    };
    
    if (config.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        // Only include servers from graph file (or undefined source, for backwards compatibility)
        if (serverConfig._source !== 'external') {
          // Create clean copy without _source metadata
          const { _source, ...cleanConfig } = serverConfig;
          if (!configToWrite.mcpServers) {
            configToWrite.mcpServers = {};
          }
          configToWrite.mcpServers[name] = cleanConfig;
        }
      }
    }

    // Use js-yaml dump with readable formatting
    const yamlString = dump(configToWrite, {
      indent: 2,
      lineWidth: -1, // No line wrapping
      noRefs: true, // Don't use YAML references
      sortKeys: false, // Preserve key order
    });

    writeFileSync(filePath, yamlString, "utf-8");
    logger.info(`Saved configuration to: ${filePath}`);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to write YAML config: ${error.message}`);
      throw error;
    }
    throw new Error("Unknown error writing YAML config");
  }
}

