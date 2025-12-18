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

const baseNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  next: z.string().optional(),
});

const entryNodeSchema = baseNodeSchema.extend({
  type: z.literal("entry"),
  next: z.string(),
});

const exitNodeSchema = baseNodeSchema.extend({
  type: z.literal("exit"),
});

const mcpToolNodeSchema = baseNodeSchema.extend({
  type: z.literal("mcp_tool"),
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
  mcpToolNodeSchema,
  transformNodeSchema,
  switchNodeSchema,
]);

const toolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: jsonSchemaSchema,
  outputSchema: jsonSchemaSchema,
  entryNode: z.string(),
  exitNode: z.string(),
});

export const mcpGraphConfigSchema = z.object({
  version: z.string(),
  server: serverMetadataSchema,
  tools: z.array(toolDefinitionSchema),
  nodes: z.array(nodeSchema),
});

export type McpGraphConfigSchema = z.infer<typeof mcpGraphConfigSchema>;

