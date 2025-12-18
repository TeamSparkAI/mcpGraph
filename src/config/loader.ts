/**
 * Configuration loader for mcpGraph
 */

import { parseYamlConfig } from "./parser.js";
import type { McpGraphConfig } from "../types/config.js";

export function loadConfig(filePath: string): McpGraphConfig {
  return parseYamlConfig(filePath);
}

