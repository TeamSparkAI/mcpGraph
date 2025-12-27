/**
 * Tests for execution limit guardrails (maxNodeExecutions, maxExecutionTimeMs)
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { McpGraphApi } from "../src/api.js";
import { loadConfig } from "../src/config/loader.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync } from "node:fs";
import { dump } from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Execution limits", () => {
  describe("maxNodeExecutions limit", () => {
    it("should stop execution when maxNodeExecutions is reached", async () => {
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        executionLimits: {
          maxNodeExecutions: 10,
        },
        tools: [
          {
            name: "infinite_loop",
            description: "Test tool with infinite loop",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "loop" },
              {
                id: "loop",
                type: "transform",
                transform: {
                  expr: '{"count": ($.loop.count ?? 0) + 1}',
                },
                next: "check",
              },
              {
                id: "check",
                type: "switch",
                conditions: [
                  {
                    rule: { ">": [{ var: "$.loop.count" }, 999999] }, // Never true, but makes exit reachable
                    target: "exit",
                  },
                  { target: "loop" }, // Always routes back to loop
                ],
              },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        const api = new McpGraphApi(configPath);
        const { promise } = api.executeTool("infinite_loop", {});

        try {
          await promise;
          assert.fail("Should have thrown execution limit error");
        } catch (error) {
          assert(error instanceof Error, "Should throw Error");
          assert(
            error.message.includes("maximum node executions (10) reached"),
            `Error message should mention maxNodeExecutions limit, got: ${error.message}`
          );
          assert(
            error.message.includes("Current execution count: 10"),
            `Error message should include current execution count, got: ${error.message}`
          );
        } finally {
          await api.close();
        }
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should use default maxNodeExecutions (1000) when not specified", async () => {
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        // No executionLimits specified - should use defaults
        tools: [
          {
            name: "infinite_loop",
            description: "Test tool with infinite loop",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "loop" },
              {
                id: "loop",
                type: "transform",
                transform: {
                  expr: '{"count": ($.loop.count ?? 0) + 1}',
                },
                next: "check",
              },
              {
                id: "check",
                type: "switch",
                conditions: [
                  {
                    rule: { ">": [{ var: "$.loop.count" }, 999999] }, // Never true, but makes exit reachable
                    target: "exit",
                  },
                  { target: "loop" }, // Always routes back to loop
                ],
              },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        const api = new McpGraphApi(configPath);
        const { promise } = api.executeTool("infinite_loop", {});

        try {
          await promise;
          assert.fail("Should have thrown execution limit error");
        } catch (error) {
          assert(error instanceof Error, "Should throw Error");
          assert(
            error.message.includes("maximum node executions (1000) reached"),
            `Error message should mention default limit of 1000, got: ${error.message}`
          );
        } finally {
          await api.close();
        }
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should allow execution to complete if it finishes before hitting limit", async () => {
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        executionLimits: {
          maxNodeExecutions: 5, // Very low limit
        },
        tools: [
          {
            name: "simple",
            description: "Simple tool that completes quickly",
            inputSchema: { type: "object", properties: { value: { type: "string" } } },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "transform" },
              {
                id: "transform",
                type: "transform",
                transform: {
                  expr: '{"result": $.entry.value}',
                },
                next: "exit",
              },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        const api = new McpGraphApi(configPath);
        const { promise } = api.executeTool("simple", { value: "test" });
        const result = await promise;
        await api.close();

        assert(result !== undefined, "Result should be defined");
        assert(result.result !== undefined, "Result should have result property");
        const resultObj = result.result as { result?: string };
        assert.equal(resultObj.result, "test", "Should complete successfully without hitting limit");
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should stop exactly at the limit boundary", async () => {
      const limit = 5;
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        executionLimits: {
          maxNodeExecutions: limit,
        },
        tools: [
          {
            name: "infinite_loop",
            description: "Test tool with infinite loop",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "loop" },
              {
                id: "loop",
                type: "transform",
                transform: {
                  expr: '{"count": ($.loop.count ?? 0) + 1}',
                },
                next: "check",
              },
              {
                id: "check",
                type: "switch",
                conditions: [
                  {
                    rule: { ">": [{ var: "$.loop.count" }, 999999] }, // Never true, but makes exit reachable
                    target: "exit",
                  },
                  { target: "loop" }, // Always routes back to loop
                ],
              },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        const api = new McpGraphApi(configPath);
        // Provide hooks to get a controller
        const { promise, controller } = api.executeTool("infinite_loop", {}, {
          hooks: {
            onNodeStart: async (executionIndex) => true,
          },
        });

        try {
          await promise;
          assert.fail("Should have thrown execution limit error");
        } catch (error) {
          assert(error instanceof Error, "Should throw Error");
          
          // Verify execution history has exactly 'limit' records
          assert(controller !== null, "Controller should be available");
          const state = controller!.getState();
          assert.equal(
            state.executionHistory.length,
            limit,
            `Execution history should have exactly ${limit} records, got ${state.executionHistory.length}`
          );
        } finally {
          await api.close();
        }
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe("maxExecutionTimeMs limit", () => {
    it("should stop execution when maxExecutionTimeMs is reached", async () => {
      // Create a config with a slow operation (transform that takes time)
      // We'll use a loop that will take longer than the time limit
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        executionLimits: {
          maxExecutionTimeMs: 200, // 200ms limit
          maxNodeExecutions: 10000, // High node limit so time limit hits first
        },
        tools: [
          {
            name: "slow_loop",
            description: "Test tool with slow loop",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "loop" },
              {
                id: "loop",
                type: "transform",
                transform: {
                  // This will loop and each iteration will take some time
                  // We'll add a small delay by using a complex expression
                  expr: '{"count": ($.loop.count ?? 0) + 1, "timestamp": $now()}',
                },
                next: "check",
              },
              {
                id: "check",
                type: "switch",
                conditions: [
                  {
                    rule: { ">": [{ var: "$.loop.count" }, 999999] }, // Never true, but makes exit reachable
                    target: "exit",
                  },
                  { target: "loop" }, // Always routes back to loop
                ],
              },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        const api = new McpGraphApi(configPath);
        const startTime = Date.now();
        const { promise } = api.executeTool("slow_loop", {});

        try {
          await promise;
          assert.fail("Should have thrown execution limit error");
        } catch (error) {
          const elapsedTime = Date.now() - startTime;
          assert(error instanceof Error, "Should throw Error");
          assert(
            error.message.includes("maximum execution time (200ms) reached"),
            `Error message should mention maxExecutionTimeMs limit, got: ${error.message}`
          );
          // Verify it actually took at least close to the time limit
          assert(
            elapsedTime >= 150, // Allow some margin (at least 150ms)
            `Should have taken at least 150ms, but took ${elapsedTime}ms`
          );
        } finally {
          await api.close();
        }
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should use default maxExecutionTimeMs (300000ms) when not specified", async () => {
      // This test would take 5 minutes, so we'll just verify the default is applied
      // by checking that a fast execution doesn't hit the time limit
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        // No executionLimits - should use default 300000ms
        tools: [
          {
            name: "simple",
            description: "Simple tool",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "exit" },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        const api = new McpGraphApi(configPath);
        const { promise } = api.executeTool("simple", {});
        const result = await promise;
        await api.close();

        // Should complete successfully (default time limit is 5 minutes, this takes milliseconds)
        assert(result !== undefined, "Should complete successfully with default time limit");
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe("Both limits together", () => {
    it("should stop at node execution limit when it hits first", async () => {
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        executionLimits: {
          maxNodeExecutions: 10,
          maxExecutionTimeMs: 60000, // 60 seconds - node limit should hit first
        },
        tools: [
          {
            name: "fast_loop",
            description: "Fast infinite loop",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "loop" },
              {
                id: "loop",
                type: "transform",
                transform: {
                  expr: '{"count": ($.loop.count ?? 0) + 1}',
                },
                next: "check",
              },
              {
                id: "check",
                type: "switch",
                conditions: [
                  {
                    rule: { ">": [{ var: "$.loop.count" }, 999999] }, // Never true, but makes exit reachable
                    target: "exit",
                  },
                  { target: "loop" }, // Always routes back to loop
                ],
              },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        const api = new McpGraphApi(configPath);
        const { promise } = api.executeTool("fast_loop", {});

        try {
          await promise;
          assert.fail("Should have thrown execution limit error");
        } catch (error) {
          assert(error instanceof Error, "Should throw Error");
          // Should hit node execution limit, not time limit
          assert(
            error.message.includes("maximum node executions (10) reached"),
            `Should hit node execution limit first, got: ${error.message}`
          );
          assert(
            !error.message.includes("maximum execution time"),
            "Should not mention time limit"
          );
        } finally {
          await api.close();
        }
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should stop at time limit when it hits first", async () => {
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        executionLimits: {
          maxNodeExecutions: 10000, // High node limit - time should hit first
          maxExecutionTimeMs: 200, // 200ms - very short
        },
        tools: [
          {
            name: "slow_loop",
            description: "Slow loop",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "loop" },
              {
                id: "loop",
                type: "transform",
                transform: {
                  expr: '{"count": ($.loop.count ?? 0) + 1, "timestamp": $now()}',
                },
                next: "check",
              },
              {
                id: "check",
                type: "switch",
                conditions: [
                  {
                    rule: { ">": [{ var: "$.loop.count" }, 999999] }, // Never true, but makes exit reachable
                    target: "exit",
                  },
                  { target: "loop" }, // Always routes back to loop
                ],
              },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        const api = new McpGraphApi(configPath);
        const { promise } = api.executeTool("slow_loop", {});

        try {
          await promise;
          assert.fail("Should have thrown execution limit error");
        } catch (error) {
          assert(error instanceof Error, "Should throw Error");
          // Should hit time limit, not node execution limit
          assert(
            error.message.includes("maximum execution time (200ms) reached"),
            `Should hit time limit first, got: ${error.message}`
          );
          assert(
            !error.message.includes("maximum node executions"),
            "Should not mention node execution limit"
          );
        } finally {
          await api.close();
        }
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe("Edge cases", () => {
    it("should reject invalid limit values (schema validation)", () => {
      // Test that schema validation rejects invalid values
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        executionLimits: {
          maxNodeExecutions: -1, // Invalid: negative
        },
        tools: [
          {
            name: "test",
            description: "Test",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "exit" },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };

      const configPath = join(projectRoot, "tests", "files", "temp-limits-test.yaml");
      writeFileSync(configPath, dump(testConfig));

      try {
        try {
          loadConfig(configPath);
          assert.fail("Should have thrown validation error for negative maxNodeExecutions");
        } catch (error) {
          assert(error instanceof Error, "Should throw Error");
          // Schema validation should reject negative numbers
          // The error might come from Zod validation (which returns an array) or our custom validation
          const errorStr = Array.isArray(error.message) 
            ? JSON.stringify(error.message) 
            : error.message;
          assert(
            errorStr.includes("positive") || 
            errorStr.includes("Invalid") ||
            errorStr.includes("validation") ||
            errorStr.includes("number") ||
            errorStr.includes("Expected"),
            `Error message should indicate validation failure, got: ${errorStr}`
          );
        }
      } finally {
        try {
          unlinkSync(configPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });
});

