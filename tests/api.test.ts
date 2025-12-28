/**
 * API integration tests for graph execution
 * Tests both count_files and switch examples using the programmatic API
 */

import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { McpGraphApi, ToolCallMcpError } from "../src/api.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { chdir, cwd } from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("API integration", () => {
  describe("getServerInfo", () => {
    it("should default title to name when title is not provided in config", async () => {
      const configPath = join(projectRoot, "examples", "test_minimal.yaml");
      const api = new McpGraphApi(configPath);
      const serverInfo = api.getServerInfo();
      
      assert.equal(serverInfo.name, "testMinimal", "Should have correct name");
      assert.equal(serverInfo.title, "testMinimal", "Title should default to name when not provided");
      
      await api.close();
    });

    it("should use provided title when title is specified", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);
      
      const serverInfo = api.getServerInfo();
      
      assert.equal(serverInfo.name, "fileUtils", "Should have correct name");
      assert.equal(serverInfo.title, "File utilities", "Should use provided title");
      
      await api.close();
    });

    it("should return instructions when provided in config", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);
      const serverInfo = api.getServerInfo();
      
      assert.equal(serverInfo.name, "fileUtils", "Should have correct name");
      assert.equal(serverInfo.title, "File utilities", "Should have correct title");
      assert.equal(serverInfo.instructions, "This server provides file utility tools for counting files in directories.", "Should return instructions when provided");
      
      await api.close();
    });

    it("should return undefined for instructions when not provided", async () => {
      const configPath = join(projectRoot, "examples", "test_minimal.yaml");
      const api = new McpGraphApi(configPath);
      
      const serverInfo = api.getServerInfo();
      
      assert.equal(serverInfo.name, "testMinimal", "Should have correct name");
      assert(serverInfo.instructions === undefined, "Instructions should be undefined when not provided");
      
      await api.close();
    });
  });

  describe("count_files example", () => {
    let api: McpGraphApi;

    before(async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      api = new McpGraphApi(configPath);
    });

    after(async () => {
      await api.close();
    });

    it("should count files in the test directory", async () => {
      const testDir = join(projectRoot, "tests", "counting");
      const { promise } = api.executeTool("count_files", {
        directory: testDir,
      });
      const result = await promise;

      assert(result !== undefined, "Result should be defined");
      assert(result.result !== undefined, "Result should have result property");
      assert(typeof result.result === "object", "Result should be an object");
      
      const resultObj = result.result as { count?: number };
      assert("count" in resultObj, "Result should have count property");
      assert(typeof resultObj.count === "number", "Count should be a number");
      assert(resultObj.count > 0, "Count should be greater than 0");
      
      // Verify structuredContent matches
      assert(result.structuredContent !== undefined, "Should have structuredContent");
      assert(typeof result.structuredContent === "object", "structuredContent should be an object");
      const structuredContent = result.structuredContent as Record<string, unknown>;
      assert("count" in structuredContent, "structuredContent should have count property");
      assert(structuredContent.count === resultObj.count, "structuredContent count should match result count");
    });

    it("should wrap connection errors and include stderr when running from wrong cwd", async () => {
      // Save original cwd
      const originalCwd = cwd();
      
      try {
        // Change to a different directory (this will cause the filesystem MCP server
        // to fail because it can't find the relative path ./tests/counting)
        chdir("/tmp");
        
        // Create a new API instance with absolute config path
        const configPath = join(projectRoot, "examples", "count_files.yaml");
        const api = new McpGraphApi(configPath);
        
        const testDir = join(projectRoot, "tests", "counting");
        const { promise } = api.executeTool("count_files", {
          directory: testDir,
        });
        
        // This should fail with ToolCallMcpError
        try {
          await promise;
          assert.fail("Expected ToolCallMcpError to be thrown");
        } catch (error) {
          // Verify it's a ToolCallMcpError
          assert(error instanceof ToolCallMcpError, "Error should be ToolCallMcpError");
          
          const mcpError = error as ToolCallMcpError;
          
          // Verify stderr property exists and contains content
          assert("stderr" in mcpError, "ToolCallMcpError should have stderr property");
          assert(Array.isArray(mcpError.stderr), "stderr should be an array");
          assert(mcpError.stderr.length > 0, "stderr should contain error output from the MCP server");
          
          // Verify error code and message
          assert.equal(mcpError.code, -32000, "Error code should be -32000");
          assert(mcpError.message.includes("Connection closed"), "Error message should mention connection closed");
        }
        
        await api.close();
      } finally {
        // Always restore original cwd
        chdir(originalCwd);
      }
    });
  });

  describe("switch example", () => {
    let api: McpGraphApi;

    before(async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      api = new McpGraphApi(configPath);
    });

    after(async () => {
      await api.close();
    });

    it("should route to high_path when value is greater than 10", async () => {
      const { promise } = api.executeTool("test_switch", {
        value: 15,
      });
      const result = await promise;

      assert(result !== undefined, "Result should be defined");
      const resultObj = result.result as { result?: string };
      assert(resultObj.result === "high", `Expected "high", got "${resultObj.result}"`);
    });

    it("should route to low_path when value is between 1 and 10", async () => {
      const { promise } = api.executeTool("test_switch", {
        value: 5,
      });
      const result = await promise;

      assert(result !== undefined, "Result should be defined");
      const resultObj = result.result as { result?: string };
      assert(resultObj.result === "low", `Expected "low", got "${resultObj.result}"`);
    });

    it("should route to zero_path (default) when value is zero", async () => {
      const { promise } = api.executeTool("test_switch", {
        value: 0,
      });
      const result = await promise;

      assert(result !== undefined, "Result should be defined");
      const resultObj = result.result as { result?: string };
      assert(resultObj.result === "zero_or_negative", `Expected "zero_or_negative", got "${resultObj.result}"`);
    });

    it("should route to zero_path (default) when value is negative", async () => {
      const { promise } = api.executeTool("test_switch", {
        value: -5,
      });
      const result = await promise;

      assert(result !== undefined, "Result should be defined");
      const resultObj = result.result as { result?: string };
      assert(resultObj.result === "zero_or_negative", `Expected "zero_or_negative", got "${resultObj.result}"`);
    });
  });
});

