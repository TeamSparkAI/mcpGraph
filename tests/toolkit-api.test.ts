/**
 * Unit/Integration tests for toolkit API functionality
 * Tests graph manipulation, MCP discovery, expression testers, file I/O, and inline execution
 */

import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { McpGraphApi } from "../src/api.js";
import { ToolkitApi } from "../src/toolkit/api.js";
import { McpDiscovery } from "../src/toolkit/mcp-discovery.js";
import { testJSONata, testJSONLogic } from "../src/toolkit/expression-testers.js";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { dump } from "js-yaml";
import { loadConfig } from "../src/config/loader.js";
import type { ToolDefinition } from "../src/types/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Toolkit API", () => {
  describe("Graph manipulation", () => {
    let tempConfigPath: string;
    let api: McpGraphApi;

    before(() => {
      // Create a temporary config file for testing
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        tools: [
          {
            name: "existing_tool",
            description: "Existing tool",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "exit" },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };
      tempConfigPath = join(projectRoot, "tests", "files", "temp-toolkit-test.yaml");
      writeFileSync(tempConfigPath, dump(testConfig));
      api = new McpGraphApi(tempConfigPath);
    });

    after(async () => {
      await api.close();
      try {
        unlinkSync(tempConfigPath);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should add a new tool to the graph", () => {
      const newTool: ToolDefinition = {
        name: "new_tool",
        description: "New tool",
        inputSchema: { type: "object", properties: { value: { type: "string" } } },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };

      api.addTool(newTool);
      const config = api.getConfig();
      const tool = config.tools.find((t) => t.name === "new_tool");
      
      assert(tool !== undefined, "Tool should be added");
      assert.equal(tool.name, "new_tool", "Tool should have correct name");
      assert.equal(tool.description, "New tool", "Tool should have correct description");
    });

    it("should update an existing tool", () => {
      const updatedTool: ToolDefinition = {
        name: "existing_tool",
        description: "Updated description",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };

      api.updateTool("existing_tool", updatedTool);
      const config = api.getConfig();
      const tool = config.tools.find((t) => t.name === "existing_tool");
      
      assert(tool !== undefined, "Tool should exist");
      assert.equal(tool.description, "Updated description", "Tool should be updated");
    });

    it("should delete a tool from the graph", () => {
      api.deleteTool("existing_tool");
      const config = api.getConfig();
      const tool = config.tools.find((t) => t.name === "existing_tool");
      
      assert(tool === undefined, "Tool should be deleted");
    });

    it("should save the graph to file", () => {
      const newTool: ToolDefinition = {
        name: "saved_tool",
        description: "Tool to save",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };

      api.addTool(newTool);
      api.save();

      // Verify file was written
      const savedConfig = loadConfig(tempConfigPath);
      const savedTool = savedConfig.tools.find((t) => t.name === "saved_tool");
      
      assert(savedTool !== undefined, "Tool should be saved to file");
      assert.equal(savedTool.description, "Tool to save", "Saved tool should have correct description");
    });

    it("should throw error when updating non-existent tool", () => {
      const tool: ToolDefinition = {
        name: "nonexistent",
        description: "Does not exist",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };

      assert.throws(
        () => api.updateTool("nonexistent", tool),
        /Tool "nonexistent" not found/
      );
    });

    it("should throw error when deleting non-existent tool", () => {
      assert.throws(
        () => api.deleteTool("nonexistent"),
        /Tool "nonexistent" not found/
      );
    });
  });

  describe("Expression testers", () => {
    it("should test valid JSONata expression", async () => {
      const result = await testJSONata('{"result": $.value * 2}', { value: 5 });
      
      assert(result.error === undefined, "Should not have error");
      assert(result.result !== null, "Should have result");
      const resultObj = result.result as { result?: number };
      assert.equal(resultObj.result, 10, "Should evaluate correctly");
    });

    it("should return error for invalid JSONata expression", async () => {
      const result = await testJSONata('{"result": $.value + }', { value: 5 });
      
      assert(result.error !== undefined, "Should have error");
      assert(result.result === null, "Result should be null on error");
      assert(result.error.message.length > 0, "Error should have message");
    });

    it("should test valid JSON Logic expression", async () => {
      const result = await testJSONLogic({ ">": [{ var: "value" }, 10] }, { value: 15 });
      
      assert(result.error === undefined, "Should not have error");
      assert.equal(result.result, true, "Should evaluate to true");
    });

    it("should test JSON Logic expression that evaluates to false", async () => {
      const result = await testJSONLogic({ ">": [{ var: "value" }, 10] }, { value: 5 });
      
      assert(result.error === undefined, "Should not have error");
      assert.equal(result.result, false, "Should evaluate to false");
    });

    it("should return error for invalid JSON Logic expression", async () => {
      // Invalid: missing required property in var operation
      const result = await testJSONLogic({ ">": [{ var: null }, 10] }, { value: 5 });
      
      assert(result.error !== undefined, "Should have error");
      assert(result.result === null, "Result should be null on error");
    });
  });

  describe("Inline tool execution", () => {
    let api: McpGraphApi;

    before(() => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      api = new McpGraphApi(configPath);
    });

    after(async () => {
      await api.close();
    });

    it("should execute a tool definition without adding it to the graph", async () => {
      const toolDefinition: ToolDefinition = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "string" },
          },
        },
        outputSchema: { type: "object" },
        nodes: [
          {
            id: "entry",
            type: "entry",
            next: "transform",
          },
          {
            id: "transform",
            type: "transform",
            transform: {
              expr: '{"result": $.entry.value}',
            },
            next: "exit",
          },
          {
            id: "exit",
            type: "exit",
          },
        ],
      };

      const result = await api.executeToolDefinition(toolDefinition, { value: "test" });
      
      assert(result !== undefined, "Result should be defined");
      assert(result.result !== undefined, "Result should have result property");
      const resultObj = result.result as { result?: string };
      assert.equal(resultObj.result, "test", "Should execute correctly");
      
      // Verify tool was not added to graph
      const config = api.getConfig();
      const tool = config.tools.find((t) => t.name === "test_tool");
      assert(tool === undefined, "Tool should not be in graph");
    });

    it("should execute tool definition with logging enabled", async () => {
      const toolDefinition: ToolDefinition = {
        name: "test_tool_logging",
        description: "Test tool with logging",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };

      const result = await api.executeToolDefinition(
        toolDefinition,
        {},
        { enableLogging: true }
      );
      
      assert(result.logs !== undefined, "Should have logs");
      assert(Array.isArray(result.logs), "Logs should be an array");
      assert(result.logs.length > 0, "Should have at least one log entry");
    });
  });

  describe("ToolkitApi wrapper", () => {
    let api: McpGraphApi;
    let toolkitApi: ToolkitApi;

    before(() => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      api = new McpGraphApi(configPath);
      toolkitApi = new ToolkitApi(api);
    });

    after(async () => {
      await toolkitApi.close();
    });

    it("should list all toolkit tools", () => {
      const tools = toolkitApi.listTools();
      
      assert(Array.isArray(tools), "Should return array");
      assert(tools.length > 0, "Should have tools");
      
      const toolNames = tools.map((t) => t.name);
      assert(toolNames.includes("getGraphServer"), "Should include getGraphServer");
      assert(toolNames.includes("listGraphTools"), "Should include listGraphTools");
      assert(toolNames.includes("runGraphTool"), "Should include runGraphTool");
      assert(toolNames.includes("testJSONata"), "Should include testJSONata");
      assert(toolNames.includes("testJSONLogic"), "Should include testJSONLogic");
    });

    it("should get graph server info via toolkit", async () => {
      const result = await toolkitApi.callTool("getGraphServer", {});
      
      assert(result !== undefined, "Result should be defined");
      const serverInfo = result as { name?: string; version?: string; title?: string };
      assert.equal(serverInfo.name, "fileUtils", "Should have correct name");
      assert.equal(serverInfo.version, "1.0.0", "Should have correct version");
    });

    it("should list graph tools via toolkit", async () => {
      const result = await toolkitApi.callTool("listGraphTools", {});
      
      assert(result !== undefined, "Result should be defined");
      const response = result as { items?: Array<{ name?: string; description?: string }> };
      assert(typeof response === "object", "Should return object");
      assert(Array.isArray(response.items), "Should have items array");
      assert(response.items!.length > 0, "Should have tools");
      
      const countFilesTool = response.items!.find((t) => t.name === "count_files");
      assert(countFilesTool !== undefined, "Should include count_files");
    });

    it("should get graph tool details via toolkit", async () => {
      const result = await toolkitApi.callTool("getGraphTool", { toolName: "count_files" });
      
      assert(result !== undefined, "Result should be defined");
      const tool = result as ToolDefinition;
      assert.equal(tool.name, "count_files", "Should have correct name");
      assert(tool.nodes !== undefined, "Should have nodes");
    });

    it("should throw error for invalid tool name", async () => {
      await assert.rejects(
        async () => {
          await toolkitApi.callTool("getGraphTool", { toolName: "nonexistent" });
        },
        /Tool "nonexistent" not found/
      );
    });
  });
});

