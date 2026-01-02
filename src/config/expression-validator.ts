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

  for (const tool of config.tools) {
    for (const node of tool.nodes) {
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
  }

  return errors;
}

/**
 * Recursively validate argument expressions
 */
function validateArgExpressions(
  args: unknown,
  path: string = "args"
): void {
  // Expression object: { "expr": "..." }
  if (
    typeof args === "object" &&
    args !== null &&
    !Array.isArray(args) &&
    Object.keys(args).length === 1 &&
    "expr" in args &&
    typeof (args as { expr: unknown }).expr === "string"
  ) {
    const expr = (args as { expr: string }).expr;
    try {
      validateJsonataSyntax(expr);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSONata syntax in ${path}.expr: ${errorMessage}`);
    }
    return;
  }

  // Expression object with other keys: error
  if (
    typeof args === "object" &&
    args !== null &&
    !Array.isArray(args) &&
    "expr" in args &&
    Object.keys(args).length > 1
  ) {
    throw new Error(
      `Invalid expression object at ${path}: object with "expr" property must have only that property. ` +
      `Found keys: ${Object.keys(args).join(", ")}`
    );
  }

  // Array: recurse into elements
  if (Array.isArray(args)) {
    args.forEach((item, index) => {
      validateArgExpressions(item, `${path}[${index}]`);
    });
    return;
  }

  // Object: recurse into properties
  if (typeof args === "object" && args !== null) {
    for (const [key, value] of Object.entries(args)) {
      validateArgExpressions(value, `${path}.${key}`);
    }
    return;
  }

  // Primitive: no validation needed
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
      // Validate any JSONata expressions in args (recursively)
      try {
        validateArgExpressions(node.args);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSONata syntax in args: ${errorMessage}`);
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

