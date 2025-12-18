/**
 * Type definitions for mcpGraph configuration
 */

export interface McpGraphConfig {
  version: string;
  server: ServerMetadata;
  tools: ToolDefinition[];
  nodes: NodeDefinition[];
}

export interface ServerMetadata {
  name: string;
  version: string;
  description: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  entryNode: string;
  exitNode: string;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
}

export interface JsonSchemaProperty {
  type: string;
  description?: string;
}

export type NodeDefinition =
  | EntryNode
  | ExitNode
  | McpNode
  | TransformNode
  | SwitchNode;

export interface BaseNode {
  id: string;
  type: string;
  next?: string;
}

export interface EntryNode extends BaseNode {
  type: "entry";
  next: string; // Required for entry nodes
}

export interface ExitNode extends BaseNode {
  type: "exit";
  // No next - this is the exit point
}

export interface McpNode extends BaseNode {
  type: "mcp";
  server: string;
  tool: string;
  args: Record<string, unknown>;
  next: string; // Required for mcp nodes
}

export interface TransformNode extends BaseNode {
  type: "transform";
  transform: {
    expr: string; // JSONata expression
  };
  next: string; // Required for transform nodes
}

export interface SwitchNode extends BaseNode {
  type: "switch";
  conditions: SwitchCondition[];
}

export interface SwitchCondition {
  rule?: JsonLogicRule;
  target: string;
}

export type JsonLogicRule = unknown; // JSON Logic rules are flexible JSON structures

