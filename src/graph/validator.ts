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

  // Validate all tools have exactly one entry and one exit node
  for (const tool of config.tools) {
    const entryNodes = config.nodes.filter(
      (n) => n.type === "entry" && (n as { tool: string }).tool === tool.name
    );
    const exitNodes = config.nodes.filter(
      (n) => n.type === "exit" && (n as { tool: string }).tool === tool.name
    );

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
  }

  // Validate entry and exit nodes reference valid tools
  for (const node of config.nodes) {
    if (node.type === "entry") {
      const toolName = (node as { tool: string }).tool;
      const tool = config.tools.find((t) => t.name === toolName);
      if (!tool) {
        errors.push({
          message: `Entry node "${node.id}" references non-existent tool "${toolName}"`,
          nodeId: node.id,
        });
      }
    }

    if (node.type === "exit") {
      const toolName = (node as { tool: string }).tool;
      const tool = config.tools.find((t) => t.name === toolName);
      if (!tool) {
        errors.push({
          message: `Exit node "${node.id}" references non-existent tool "${toolName}"`,
          nodeId: node.id,
        });
      }
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

  // Validate mcp nodes reference valid servers
  for (const node of config.nodes) {
    if (node.type === "mcp") {
      const serverName = node.server;
      if (!config.mcpServers || !config.mcpServers[serverName]) {
        errors.push({
          message: `MCP node "${node.id}" references non-existent server "${serverName}"`,
          nodeId: node.id,
        });
      }
    }
  }

  // Validate exit nodes are reachable (basic check - can be enhanced)
  for (const tool of config.tools) {
    const entryNodes = config.nodes.filter(
      (n) => n.type === "entry" && (n as { tool: string }).tool === tool.name
    );
    const exitNodes = config.nodes.filter(
      (n) => n.type === "exit" && (n as { tool: string }).tool === tool.name
    );

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

