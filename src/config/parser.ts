/**
 * YAML parser for mcpGraph configuration
 */

import { load } from "js-yaml";
import { readFileSync } from "node:fs";
import { mcpGraphConfigSchema } from "./schema.js";
import type { McpGraphConfig } from "../types/config.js";
import { logger } from "../logger.js";
import { validateConfigExpressions } from "./expression-validator.js";

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

