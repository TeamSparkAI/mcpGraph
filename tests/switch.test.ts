/**
 * Test for switch node execution
 */

import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { loadConfig } from "../src/config/loader.js";
import { validateGraph } from "../src/graph/validator.js";
import { GraphExecutor } from "../src/execution/executor.js";
import { McpClientManager } from "../src/mcp/client-manager.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("switch node", () => {
  let executor: GraphExecutor;
  let clientManager: McpClientManager;
  let testConfigPath: string;

  before(async () => {
    // Create a test config with a switch node
    const testConfig = {
      version: "1.0",
      server: {
        name: "test",
        version: "1.0.0",
        description: "Test server",
      },
      tools: [
        {
          name: "test_switch",
          description: "Test switch node",
          inputSchema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
          },
          outputSchema: {
            type: "object",
            properties: {
              result: { type: "string" },
            },
          },
        },
      ],
      nodes: [
        {
          id: "entry",
          type: "entry",
          tool: "test_switch",
          next: "switch_node",
        },
        {
          id: "switch_node",
          type: "switch",
          conditions: [
            {
              rule: { ">": [{ var: "value" }, 10] },
              target: "high_path",
            },
            {
              rule: { ">": [{ var: "value" }, 0] },
              target: "low_path",
            },
            {
              // Default/fallback case (no rule)
              target: "zero_path",
            },
          ],
        },
        {
          id: "high_path",
          type: "transform",
          transform: {
            expr: '{ "result": "high" }',
          },
          next: "exit",
        },
        {
          id: "low_path",
          type: "transform",
          transform: {
            expr: '{ "result": "low" }',
          },
          next: "exit",
        },
        {
          id: "zero_path",
          type: "transform",
          transform: {
            expr: '{ "result": "zero" }',
          },
          next: "exit",
        },
        {
          id: "exit",
          type: "exit",
          tool: "test_switch",
        },
      ],
    };

    // Write test config to a temporary file
    testConfigPath = join(projectRoot, "tests", "switch-test-config.yaml");
    mkdirSync(join(projectRoot, "tests"), { recursive: true });
    writeFileSync(testConfigPath, yaml.dump(testConfig));

    const config = loadConfig(testConfigPath);

    const errors = validateGraph(config);
    if (errors.length > 0) {
      throw new Error(`Graph validation failed: ${errors.map((e) => e.message).join(", ")}`);
    }

    clientManager = new McpClientManager();
    executor = new GraphExecutor(config, clientManager);
  });

  after(async () => {
    await clientManager.closeAll();
    // Clean up test config file
    try {
      unlinkSync(testConfigPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  it("should route to high_path when value > 10", async () => {
    const result = await executor.executeTool("test_switch", { value: 15 });

    assert(result !== undefined, "Result should be defined");
    assert(typeof result === "object", "Result should be an object");
    assert("result" in (result as object), "Result should have result property");
    assert((result as { result: string }).result === "high", "Result should be 'high'");
  });

  it("should route to low_path when 0 < value <= 10", async () => {
    const result = await executor.executeTool("test_switch", { value: 5 });

    assert(result !== undefined, "Result should be defined");
    assert(typeof result === "object", "Result should be an object");
    assert("result" in (result as object), "Result should have result property");
    assert((result as { result: string }).result === "low", "Result should be 'low'");
  });

  it("should route to zero_path (default) when value <= 0", async () => {
    const result = await executor.executeTool("test_switch", { value: 0 });

    assert(result !== undefined, "Result should be defined");
    assert(typeof result === "object", "Result should be an object");
    assert("result" in (result as object), "Result should have result property");
    assert((result as { result: string }).result === "zero", "Result should be 'zero'");
  });

  it("should route to zero_path (default) when value is negative", async () => {
    const result = await executor.executeTool("test_switch", { value: -5 });

    assert(result !== undefined, "Result should be defined");
    assert(typeof result === "object", "Result should be an object");
    assert("result" in (result as object), "Result should have result property");
    assert((result as { result: string }).result === "zero", "Result should be 'zero'");
  });
});

