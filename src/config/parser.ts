/**
 * YAML parser for mcpGraph configuration
 */

import { load } from "js-yaml";
import { readFileSync } from "node:fs";
import { mcpGraphConfigSchema } from "./schema.js";
import type { McpGraphConfig } from "../types/config.js";
import { logger } from "../logger.js";

export function parseYamlConfig(filePath: string): McpGraphConfig {
  try {
    const fileContents = readFileSync(filePath, "utf-8");
    const parsed = load(fileContents) as unknown;

    // Validate against schema
    const validated = mcpGraphConfigSchema.parse(parsed);

    return validated as McpGraphConfig;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to parse YAML config: ${error.message}`);
      throw error;
    }
    throw new Error("Unknown error parsing YAML config");
  }
}

