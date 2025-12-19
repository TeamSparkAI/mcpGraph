/**
 * API integration tests for graph execution
 * Tests both count_files and switch examples using the programmatic API
 */

import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { McpGraphApi } from "../src/api.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("API integration", () => {
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
      const testDir = join(projectRoot, "tests", "files");
      const result = await api.executeTool("count_files", {
        directory: testDir,
      });

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
      const result = await api.executeTool("test_switch", {
        value: 15,
      });

      assert(result !== undefined, "Result should be defined");
      const resultObj = result.result as { result?: string };
      assert(resultObj.result === "high", `Expected "high", got "${resultObj.result}"`);
    });

    it("should route to low_path when value is between 1 and 10", async () => {
      const result = await api.executeTool("test_switch", {
        value: 5,
      });

      assert(result !== undefined, "Result should be defined");
      const resultObj = result.result as { result?: string };
      assert(resultObj.result === "low", `Expected "low", got "${resultObj.result}"`);
    });

    it("should route to zero_path (default) when value is zero", async () => {
      const result = await api.executeTool("test_switch", {
        value: 0,
      });

      assert(result !== undefined, "Result should be defined");
      const resultObj = result.result as { result?: string };
      assert(resultObj.result === "zero_or_negative", `Expected "zero_or_negative", got "${resultObj.result}"`);
    });

    it("should route to zero_path (default) when value is negative", async () => {
      const result = await api.executeTool("test_switch", {
        value: -5,
      });

      assert(result !== undefined, "Result should be defined");
      const resultObj = result.result as { result?: string };
      assert(resultObj.result === "zero_or_negative", `Expected "zero_or_negative", got "${resultObj.result}"`);
    });
  });
});

