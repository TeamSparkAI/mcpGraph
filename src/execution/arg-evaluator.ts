/**
 * Utility for evaluating MCP node arguments with recursive JSONata expression support
 */

import type { NodeExecutionRecord } from "../types/execution.js";
import { evaluateJsonata } from "../expressions/jsonata.js";
import { logger } from "../logger.js";

/**
 * Recursively evaluate argument values, treating objects with single "expr" property as JSONata expressions
 * 
 * Evaluation rules:
 * 1. Object with exactly one key "expr" (string) → evaluate as JSONata
 * 2. Object with "expr" and other keys → error (ambiguous)
 * 3. Array → recurse into each element
 * 4. Object (non-expr) → recurse into each property
 * 5. Primitive → pass through as literal
 */
export async function evaluateArgValue(
  value: unknown,
  context: Record<string, unknown>,
  history: NodeExecutionRecord[],
  currentIndex: number
): Promise<unknown> {
  // Expression object: { "expr": "..." }
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "expr" in value
  ) {
    // If expr exists, it must be the only key and must be a string
    if (Object.keys(value).length === 1) {
      const exprValue = (value as { expr: unknown }).expr;
      if (typeof exprValue !== "string") {
        throw new Error(
          `Invalid expression object: "expr" property must be a string, got ${typeof exprValue}`
        );
      }
      const expr = exprValue;
      const evaluated = await evaluateJsonata(expr, context, history, currentIndex);
      logger.debug(`JSONata "${expr}" evaluated to: ${JSON.stringify(evaluated)}`);
      return evaluated;
    } else {
      // Expression object with other keys: error
      throw new Error(
        `Invalid expression object: object with "expr" property must have only that property. ` +
        `Found keys: ${Object.keys(value).join(", ")}`
      );
    }
  }

  // Array: recurse into elements
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item) => evaluateArgValue(item, context, history, currentIndex))
    );
  }

  // Object: recurse into properties
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = await evaluateArgValue(val, context, history, currentIndex);
    }
    return result;
  }

  // Primitive: pass through as literal
  return value;
}
