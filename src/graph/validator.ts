/**
 * Graph structure validator
 */

import type { McpGraphConfig } from "../types/config.js";
import { Graph } from "./graph.js";
import { logger } from "../logger.js";

export interface ValidationError {
  message: string;
  nodeId?: string;
  toolName?: string;
}

export function validateGraph(config: McpGraphConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = new Graph(config.nodes);

  // Validate all tools have valid entry and exit nodes
  for (const tool of config.tools) {
    if (!graph.hasNode(tool.entryNode)) {
      errors.push({
        message: `Tool "${tool.name}" references non-existent entry node "${tool.entryNode}"`,
        toolName: tool.name,
      });
    }

    if (!graph.hasNode(tool.exitNode)) {
      errors.push({
        message: `Tool "${tool.name}" references non-existent exit node "${tool.exitNode}"`,
        toolName: tool.name,
      });
    }

    // Validate entry node is actually an entry node
    const entryNode = graph.getNode(tool.entryNode);
    if (entryNode && entryNode.type !== "entry") {
      errors.push({
        message: `Tool "${tool.name}" entry node "${tool.entryNode}" is not an entry node`,
        toolName: tool.name,
        nodeId: tool.entryNode,
      });
    }

    // Validate exit node is actually an exit node
    const exitNode = graph.getNode(tool.exitNode);
    if (exitNode && exitNode.type !== "exit") {
      errors.push({
        message: `Tool "${tool.name}" exit node "${tool.exitNode}" is not an exit node`,
        toolName: tool.name,
        nodeId: tool.exitNode,
      });
    }
  }

  // Validate all node references exist
  for (const node of config.nodes) {
    if ("next" in node && node.next) {
      if (!graph.hasNode(node.next)) {
        errors.push({
          message: `Node "${node.id}" references non-existent next node "${node.next}"`,
          nodeId: node.id,
        });
      }
    }

    if (node.type === "switch") {
      for (const condition of node.conditions) {
        if (!graph.hasNode(condition.target)) {
          errors.push({
            message: `Switch node "${node.id}" references non-existent target "${condition.target}"`,
            nodeId: node.id,
          });
        }
      }
    }
  }

  // Validate exit nodes are reachable (basic check - can be enhanced)
  for (const tool of config.tools) {
    if (!isReachable(graph, tool.entryNode, tool.exitNode)) {
      errors.push({
        message: `Tool "${tool.name}" exit node "${tool.exitNode}" is not reachable from entry node "${tool.entryNode}"`,
        toolName: tool.name,
      });
    }
  }

  return errors;
}

function isReachable(graph: Graph, startId: string, targetId: string): boolean {
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const nextNodes = graph.getNextNodes(current);
    queue.push(...nextNodes);
  }

  return false;
}

