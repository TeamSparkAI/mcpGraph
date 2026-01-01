/**
 * Graph structure validator
 */

import type { McpGraphConfig, NodeDefinition } from "../types/config.js";
import { Graph } from "./graph.js";
import { logger } from "../logger.js";

export interface ValidationError {
  message: string;
  nodeId?: string;
  toolName?: string;
}

export function validateGraph(config: McpGraphConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate each tool's graph independently
  for (const tool of config.tools) {
    const toolErrors = validateToolGraph(tool, config);
    errors.push(...toolErrors);
  }

  return errors;
}

function validateToolGraph(tool: { name: string; nodes: NodeDefinition[] }, config: McpGraphConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = new Graph(tool.nodes);

  // Validate tool has exactly one entry and one exit node
  const entryNodes = tool.nodes.filter((n) => n.type === "entry");
  const exitNodes = tool.nodes.filter((n) => n.type === "exit");

  if (entryNodes.length === 0) {
    errors.push({
      message: `Tool "${tool.name}" has no entry node`,
      toolName: tool.name,
    });
  } else if (entryNodes.length > 1) {
    errors.push({
      message: `Tool "${tool.name}" has multiple entry nodes: ${entryNodes.map((n) => n.id).join(", ")}`,
      toolName: tool.name,
    });
  }

  if (exitNodes.length === 0) {
    errors.push({
      message: `Tool "${tool.name}" has no exit node`,
      toolName: tool.name,
    });
  } else if (exitNodes.length > 1) {
    errors.push({
      message: `Tool "${tool.name}" has multiple exit nodes: ${exitNodes.map((n) => n.id).join(", ")}`,
      toolName: tool.name,
    });
  }

  // Validate all node references exist within this tool's graph
  for (const node of tool.nodes) {
    if ("next" in node && node.next) {
      if (!graph.hasNode(node.next)) {
        errors.push({
          message: `Node "${node.id}" in tool "${tool.name}" references non-existent next node "${node.next}"`,
          nodeId: node.id,
          toolName: tool.name,
        });
      }
    }

    if (node.type === "switch") {
      // Validate all condition next nodes
      for (const condition of node.conditions) {
        if (!graph.hasNode(condition.next)) {
          errors.push({
            message: `Switch node "${node.id}" in tool "${tool.name}" references non-existent next node "${condition.next}"`,
            nodeId: node.id,
            toolName: tool.name,
          });
        }
      }
      // Validate default next node
      if (!graph.hasNode(node.next)) {
        errors.push({
          message: `Switch node "${node.id}" in tool "${tool.name}" references non-existent default next node "${node.next}"`,
          nodeId: node.id,
          toolName: tool.name,
        });
      }
    }
  }

  // Validate mcp nodes reference valid servers
  for (const node of tool.nodes) {
    if (node.type === "mcp") {
      const serverName = node.server;
      if (!config.mcpServers || !config.mcpServers[serverName]) {
        errors.push({
          message: `MCP node "${node.id}" in tool "${tool.name}" references non-existent server "${serverName}"`,
          nodeId: node.id,
          toolName: tool.name,
        });
      }
    }
  }

  // Validate exit nodes are reachable (basic check - can be enhanced)
  if (entryNodes.length === 1 && exitNodes.length === 1) {
    const entryNode = entryNodes[0];
    const exitNode = exitNodes[0];
    if (!isReachable(graph, entryNode.id, exitNode.id)) {
      errors.push({
        message: `Tool "${tool.name}" exit node "${exitNode.id}" is not reachable from entry node "${entryNode.id}"`,
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

