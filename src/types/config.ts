/**
 * Type definitions for mcpGraph configuration
 */

export interface ExecutionLimits {
  maxNodeExecutions?: number; // Maximum total node executions across entire graph (default: 1000)
  maxExecutionTimeMs?: number; // Maximum execution time in milliseconds (default: 300000 = 5 minutes)
}

export interface McpGraphConfig {
  version: string;
  server: ServerMetadata;
  mcpServers?: Record<string, ServerConfigWithSource>;
  executionLimits?: ExecutionLimits;
  tools: ToolDefinition[];
}

export interface ServerMetadata {
  name: string;
  version: string;
  title?: string; // Optional, defaults to name if not provided
  instructions?: string;
}

export type ServerConfig =
  | StdioServerConfig
  | SseServerConfig
  | StreamableHttpServerConfig;

/**
 * ServerConfig with optional source tracking metadata
 * Used internally to track whether a server came from the graph file or external MCP file
 */
export type ServerConfigWithSource = ServerConfig & {
  _source?: 'graph' | 'external';
};

export interface StdioServerConfig {
  type?: "stdio"; // Optional, defaults to stdio
  command: string;
  args: string[];
  cwd?: string;
}

export interface SseServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
  eventSourceInit?: Record<string, unknown>;
  requestInit?: Record<string, unknown>;
}

export interface StreamableHttpServerConfig {
  type: "streamableHttp";
  url: string;
  headers?: Record<string, string>;
  requestInit?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  nodes: NodeDefinition[];
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

