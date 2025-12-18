/**
 * JSONata expression evaluation
 */

import jsonata from "jsonata";
import { logger } from "../logger.js";

export async function evaluateJsonata(
  expression: string,
  context: Record<string, unknown>
): Promise<unknown> {
  try {
    const expr = jsonata(expression);
    const result = await expr.evaluate(context);
    
    // Log for debugging
    logger.debug(`JSONata expression: ${expression}`);
    logger.debug(`JSONata context keys: ${Object.keys(context).join(", ")}`);
    if (typeof context.list_directory_node === "string") {
      logger.debug(`list_directory_node value (first 100 chars): ${(context.list_directory_node as string).substring(0, 100)}`);
      logger.debug(`list_directory_node has actual newlines: ${(context.list_directory_node as string).includes("\n")}`);
    }
    logger.debug(`JSONata result: ${JSON.stringify(result)}`);
    
    return result;
  } catch (error) {
    logger.error(`JSONata evaluation error: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`Expression: ${expression}`);
    logger.error(`Context: ${JSON.stringify(context, null, 2)}`);
    throw error;
  }
}

