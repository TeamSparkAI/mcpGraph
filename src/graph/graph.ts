/**
 * Graph data structure and utilities
 */

import type { NodeDefinition } from "../types/config.js";

export class Graph {
  private nodes: Map<string, NodeDefinition>;
  private edges: Map<string, string[]>; // nodeId -> array of next node IDs

  constructor(nodes: NodeDefinition[]) {
    this.nodes = new Map();
    this.edges = new Map();

    for (const node of nodes) {
      this.nodes.set(node.id, node);

      // Build edges
      if ("next" in node && node.next) {
        const current = this.edges.get(node.id) || [];
        current.push(node.next);
        this.edges.set(node.id, current);
      }

      // Handle switch nodes with multiple targets
      if (node.type === "switch") {
        const targets = node.conditions.map((c) => c.target);
        this.edges.set(node.id, targets);
      }
    }
  }

  getNode(nodeId: string): NodeDefinition | undefined {
    return this.nodes.get(nodeId);
  }

  getNextNodes(nodeId: string): string[] {
    return this.edges.get(nodeId) || [];
  }

  getAllNodes(): NodeDefinition[] {
    return Array.from(this.nodes.values());
  }

  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }
}

