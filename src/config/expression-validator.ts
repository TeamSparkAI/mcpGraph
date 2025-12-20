/**
 * Expression syntax validation for mcpGraph configuration
 */

import type { McpGraphConfig, NodeDefinition } from "../types/config.js";
import { validateJsonataSyntax } from "../expressions/jsonata.js";
import { validateJsonLogicSyntax } from "../expressions/json-logic.js";
import type { ValidationError } from "../graph/validator.js";

/**
 * Validate all expressions in the configuration (JSONata and JSON Logic)
 * @param config - The configuration to validate
 * @returns Array of validation errors (empty if all valid)
 */
export function validateConfigExpressions(config: McpGraphConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of config.nodes) {
    try {
      validateNodeExpressions(node, config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        message: errorMessage,
        nodeId: node.id,
      });
    }
  }

  return errors;
}

/**
 * Validate expressions in a single node
 */
function validateNodeExpressions(node: NodeDefinition, config: McpGraphConfig): void {
  switch (node.type) {
    case "transform":
      // Validate transform expression
      try {
        validateJsonataSyntax(node.transform.expr);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSONata syntax in transform expression: ${errorMessage}`);
      }
      break;

    case "mcp":
      // Validate any JSONata expressions in args
      for (const [key, value] of Object.entries(node.args)) {
        if (typeof value === "string" && value.startsWith("$")) {
          try {
            validateJsonataSyntax(value);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid JSONata syntax in args.${key}: ${errorMessage}`);
          }
        }
      }
      break;

    case "switch":
      // Validate JSON Logic rules in conditions
      for (let i = 0; i < node.conditions.length; i++) {
        const condition = node.conditions[i];
        if (condition.rule !== undefined && condition.rule !== null) {
          try {
            validateJsonLogicSyntax(condition.rule);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid JSON Logic syntax in condition ${i + 1}: ${errorMessage}`);
          }
        }
      }
      break;

    case "entry":
    case "exit":
      // No expressions to validate
      break;
  }
}

