/**
 * Zod schemas for validating mcpGraph configuration
 */

import { z } from "zod";

const jsonSchemaPropertySchema = z.object({
  type: z.string(),
  description: z.string().optional(),
});

const jsonSchemaSchema = z.object({
  type: z.string(),
  properties: z.record(jsonSchemaPropertySchema).optional(),
  required: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const serverMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
});

const stdioServerConfigSchema = z.object({
  type: z.literal("stdio").optional(),
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string().optional(),
});

const sseServerConfigSchema = z.object({
  type: z.literal("sse"),
  url: z.string(),
  headers: z.record(z.string()).optional(),
  eventSourceInit: z.record(z.unknown()).optional(),
  requestInit: z.record(z.unknown()).optional(),
});

const streamableHttpServerConfigSchema = z.object({
  type: z.literal("streamableHttp"),
  url: z.string(),
  headers: z.record(z.string()).optional(),
  requestInit: z.record(z.unknown()).optional(),
});

// Server config can be stdio (with or without type), sse, or streamableHttp
const serverConfigSchema = z.union([
  // Stdio config (type optional, defaults to stdio)
  stdioServerConfigSchema,
  // SSE config (type required)
  sseServerConfigSchema,
  // Streamable HTTP config (type required)
  streamableHttpServerConfigSchema,
]);

const baseNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  next: z.string().optional(),
});

const entryNodeSchema = baseNodeSchema.extend({
  type: z.literal("entry"),
  tool: z.string(),
  next: z.string(),
});

const exitNodeSchema = baseNodeSchema.extend({
  type: z.literal("exit"),
  tool: z.string(),
});

const mcpNodeSchema = baseNodeSchema.extend({
  type: z.literal("mcp"),
  server: z.string(),
  tool: z.string(),
  args: z.record(z.unknown()),
  next: z.string(),
});

const transformNodeSchema = baseNodeSchema.extend({
  type: z.literal("transform"),
  transform: z.object({
    expr: z.string(),
  }),
  next: z.string(),
});

const switchConditionSchema = z.object({
  rule: z.unknown().optional(),
  target: z.string(),
});

const switchNodeSchema = baseNodeSchema.extend({
  type: z.literal("switch"),
  conditions: z.array(switchConditionSchema),
});

const nodeSchema = z.discriminatedUnion("type", [
  entryNodeSchema,
  exitNodeSchema,
  mcpNodeSchema,
  transformNodeSchema,
  switchNodeSchema,
]);

const toolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: jsonSchemaSchema,
  outputSchema: jsonSchemaSchema,
});

const executionLimitsSchema = z.object({
  maxNodeExecutions: z.number().int().positive().optional(),
  maxExecutionTimeMs: z.number().int().positive().optional(),
});

export const mcpGraphConfigSchema = z.object({
  version: z.string(),
  server: serverMetadataSchema,
  servers: z.record(serverConfigSchema).optional(),
  executionLimits: executionLimitsSchema.optional(),
  tools: z.array(toolDefinitionSchema),
  nodes: z.array(nodeSchema),
});

export type McpGraphConfigSchema = z.infer<typeof mcpGraphConfigSchema>;

