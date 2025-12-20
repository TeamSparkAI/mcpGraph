/**
 * Tests for expression syntax validation at load time
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { loadConfig } from "../src/config/loader.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync } from "node:fs";
import { dump } from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Expression syntax validation", () => {
  it("should reject invalid JSONata syntax in transform node", { timeout: 5000 }, () => {
    const testConfig = {
      version: "1.0",
      server: { name: "test", version: "1.0.0", description: "Test" },
      tools: [{ name: "test", description: "Test", inputSchema: { type: "object" }, outputSchema: { type: "object" } }],
      nodes: [
        { id: "entry", type: "entry", tool: "test", next: "transform" },
        { id: "transform", type: "transform", transform: { expr: "{ value: $.entry.value + }" }, next: "exit" },
        { id: "exit", type: "exit", tool: "test" },
      ],
    };

    const configPath = join(projectRoot, "tests", "files", "temp-validation-test.yaml");
    writeFileSync(configPath, dump(testConfig));

    try {
      loadConfig(configPath);
      assert.fail("Should have thrown validation error");
    } catch (error) {
      assert(error instanceof Error, "Should throw Error");
      assert(
        error.message.includes("expression syntax") || error.message.includes("JSONata"),
        `Error message should mention expression syntax, got: ${error.message}`
      );
    } finally {
      try {
        unlinkSync(configPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("should reject invalid JSONata syntax in MCP node args", { timeout: 5000 }, () => {
    const testConfig = {
      version: "1.0",
      server: { name: "test", version: "1.0.0", description: "Test" },
      tools: [{ name: "test", description: "Test", inputSchema: { type: "object" }, outputSchema: { type: "object" } }],
      servers: { testServer: { command: "echo", args: [] } },
      nodes: [
        { id: "entry", type: "entry", tool: "test", next: "mcp" },
        { id: "mcp", type: "mcp", server: "testServer", tool: "test", args: { path: "$.entry.value +" }, next: "exit" },
        { id: "exit", type: "exit", tool: "test" },
      ],
    };

    const configPath = join(projectRoot, "tests", "files", "temp-validation-test.yaml");
    writeFileSync(configPath, dump(testConfig));

    try {
      loadConfig(configPath);
      assert.fail("Should have thrown validation error");
    } catch (error) {
      assert(error instanceof Error, "Should throw Error");
      assert(
        error.message.includes("expression syntax") || error.message.includes("JSONata"),
        `Error message should mention expression syntax, got: ${error.message}`
      );
    } finally {
      try {
        unlinkSync(configPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("should reject invalid JSONata in JSON Logic var operation", { timeout: 5000 }, () => {
    const testConfig = {
      version: "1.0",
      server: { name: "test", version: "1.0.0", description: "Test" },
      tools: [{ name: "test", description: "Test", inputSchema: { type: "object" }, outputSchema: { type: "object" } }],
      nodes: [
        { id: "entry", type: "entry", tool: "test", next: "switch" },
        {
          id: "switch",
          type: "switch",
          conditions: [{ rule: { ">": [{ var: "$.entry.value +" }, 0] }, target: "exit" }],
        },
        { id: "exit", type: "exit", tool: "test" },
      ],
    };

    const configPath = join(projectRoot, "tests", "files", "temp-validation-test.yaml");
    writeFileSync(configPath, dump(testConfig));

    try {
      loadConfig(configPath);
      assert.fail("Should have thrown validation error");
    } catch (error) {
      assert(error instanceof Error, "Should throw Error");
      assert(
        error.message.includes("expression syntax") || error.message.includes("JSONata") || error.message.includes("JSON Logic"),
        `Error message should mention expression syntax, got: ${error.message}`
      );
    } finally {
      try {
        unlinkSync(configPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("should accept valid expressions", { timeout: 5000 }, () => {
    // Use existing valid config
    const configPath = join(projectRoot, "examples", "count_files.yaml");
    assert.doesNotThrow(() => {
      loadConfig(configPath);
    }, "Valid config should load without errors");
  });
});

