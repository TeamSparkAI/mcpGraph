/**
 * JSONata extensions for execution history access
 */

import jsonata from "jsonata";
import { logger } from "../logger.js";
import type { NodeExecutionRecord } from "../types/execution.js";

/**
 * Register custom JSONata functions for history access
 */
export function registerHistoryFunctions(
  expr: jsonata.Expression,
  history: NodeExecutionRecord[],
  currentIndex: number
): void {
  // $previousNode() - returns previous node's output
  // $previousNode(index) - returns node that executed N steps before current
  expr.registerFunction(
    "previousNode",
    (offset?: number) => {
      const stepsBack = offset !== undefined ? offset : 1;
      const targetIndex = currentIndex - stepsBack;
      
      if (targetIndex < 0 || targetIndex >= history.length) {
        logger.debug(`$previousNode(${stepsBack}): No node at index ${targetIndex}`);
        return null;
      }
      
      const record = history[targetIndex];
      logger.debug(`$previousNode(${stepsBack}) returning output from node: ${record.nodeId} (index ${targetIndex})`);
      return record.output;
    },
    "<n?:o>" // Optional number argument, returns object
  );
  
  // $executionCount(nodeName) - count of executions for a node
  expr.registerFunction(
    "executionCount",
    (nodeName: string) => {
      if (typeof nodeName !== "string") {
        return 0;
      }
      const count = history.filter(r => r.nodeId === nodeName).length;
      logger.debug(`$executionCount("${nodeName}") = ${count}`);
      return count;
    },
    "<s:n>" // String argument, returns number
  );
  
  // $nodeExecution(nodeName, index) - specific execution by index (0 = first, -1 = last)
  expr.registerFunction(
    "nodeExecution",
    (nodeName: string, index: number) => {
      if (typeof nodeName !== "string" || typeof index !== "number") {
        return null;
      }
      
      const executions = history.filter(r => r.nodeId === nodeName);
      if (executions.length === 0) {
        logger.debug(`$nodeExecution("${nodeName}", ${index}): No executions found`);
        return null;
      }
      
      // Handle negative indices (from end)
      let actualIndex = index;
      if (index < 0) {
        actualIndex = executions.length + index;
      }
      
      if (actualIndex < 0 || actualIndex >= executions.length) {
        logger.debug(`$nodeExecution("${nodeName}", ${index}): Index ${actualIndex} out of range`);
        return null;
      }
      
      const record = executions[actualIndex];
      logger.debug(`$nodeExecution("${nodeName}", ${index}) = execution at index ${actualIndex}`);
      return record.output;
    },
    "<s-n:o>" // String and number arguments, returns object
  );
  
  // $nodeExecutions(nodeName) - array of all executions for a node
  expr.registerFunction(
    "nodeExecutions",
    (nodeName: string) => {
      if (typeof nodeName !== "string") {
        return [];
      }
      const executions = history.filter(r => r.nodeId === nodeName);
      const outputs = executions.map(r => r.output);
      logger.debug(`$nodeExecutions("${nodeName}") = ${executions.length} executions`);
      return outputs;
    },
    "<s:a>" // String argument, returns array
  );
}

