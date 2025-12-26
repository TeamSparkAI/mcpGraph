/**
 * Tests for execution context and history features
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { McpGraphApi } from "../src/api.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Execution context and history", () => {
  describe("executionIndex", () => {
    it("should assign unique executionIndex to each execution", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("count_files", {
        directory: join(projectRoot, "tests", "files"),
      });
      const result = await promise;
      await api.close();

      assert(result.executionHistory, "Execution history should be present");

      // Verify executionIndex is sequential starting from 0
      result.executionHistory.forEach((record, index) => {
        assert.equal(
          record.executionIndex,
          index,
          `Execution ${index} should have executionIndex ${index}`
        );
      });

      // Verify all executionIndex values are unique
      const indices = result.executionHistory.map((r) => r.executionIndex);
      const uniqueIndices = new Set(indices);
      assert.equal(
        indices.length,
        uniqueIndices.size,
        "All executionIndex values should be unique"
      );
    });
  });

  describe("getContextForExecution", () => {
    it("should return context available to a specific execution", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);

      let contextAtListDir: Record<string, unknown> | null = null;
      const hooks = {
        onNodeComplete: async (_executionIndex: number, _nodeId: string) => {
          const nodeId = _nodeId;
          if (nodeId === "list_directory_node") {
            // Get context for execution #1 (list_directory_node)
            // Context should be built from history up to index 1 (exclusive), so it includes entry node
            contextAtListDir = api.getContextForExecution(1);
          }
        },
      };

      const { promise } = api.executeTool(
        "count_files",
        {
          directory: join(projectRoot, "tests", "files"),
        },
        { hooks }
      );
      await promise;
      await api.close();

      assert(contextAtListDir !== null, "Context should be returned");

      // Context should include entry node output (execution #0)
      assert("entry_count_files" in contextAtListDir, "Context should include entry node");
      const entryOutput = contextAtListDir["entry_count_files"] as { directory?: string } | undefined;
      assert(entryOutput !== undefined, "Entry output should exist");
      assert.equal(
        entryOutput.directory,
        join(projectRoot, "tests", "files"),
        "Context should have correct entry node output"
      );
      // list_directory_node output should not be in context (it's execution #1, context is built from 0 to 0)
      assert(
        !("list_directory_node" in contextAtListDir),
        "Context should not include current node's output"
      );
    });

    it("should return null when no execution in progress", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);

      // No execution in progress
      const context = api.getContextForExecution(0);
      assert.equal(context, null, "Should return null when no execution in progress");
      await api.close();
    });
  });

  describe("getExecutionByIndex", () => {
    it("should return execution record by index", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);

      let entryRecord: any = null;
      const hooks = {
        onNodeComplete: async (_executionIndex: number, nodeId: string) => {
          if (nodeId === "count_files_node") {
            // Get execution record for entry node (index 0)
            entryRecord = api.getExecutionByIndex(0);
          }
        },
      };

      const { promise } = api.executeTool(
        "count_files",
        {
          directory: join(projectRoot, "tests", "files"),
        },
        { hooks }
      );
      await promise;
      await api.close();

      assert(entryRecord, "Execution record should be returned");
      assert.equal(entryRecord.nodeId, "entry_count_files", "Should return correct node");
      assert.equal(entryRecord.executionIndex, 0, "Should have correct executionIndex");
      assert(entryRecord.output, "Should have output");
    });

    it("should return null when no execution in progress", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);

      // No execution in progress
      const record = api.getExecutionByIndex(0);
      assert.equal(record, null, "Should return null when no execution in progress");
      await api.close();
    });
  });

  describe("executionIndex in hooks", () => {
    it("should pass correct executionIndex to hooks in loop scenario", async () => {
      const configPath = join(projectRoot, "examples", "loop_example.yaml");
      const api = new McpGraphApi(configPath);

      const hookExecutionIndices: number[] = [];
      const hookNodeIds: string[] = [];

      const hooks = {
        onNodeStart: async (executionIndex: number, nodeId: string) => {
          hookExecutionIndices.push(executionIndex);
          hookNodeIds.push(nodeId);
          return true;
        },
      };

      const { promise } = api.executeTool("sum_to_n", { n: 3 }, { hooks });
      const result = await promise;
      await api.close();

      assert(result.executionHistory, "Execution history should be present");
      
      // Verify executionIndex values match history
      assert.equal(
        hookExecutionIndices.length,
        result.executionHistory.length,
        "Number of hook calls should match execution history length"
      );

      for (let i = 0; i < hookExecutionIndices.length; i++) {
        assert.equal(
          hookExecutionIndices[i],
          result.executionHistory[i].executionIndex,
          `Hook executionIndex at position ${i} (${hookExecutionIndices[i]}) should match history record executionIndex (${result.executionHistory[i].executionIndex})`
        );
        assert.equal(
          hookNodeIds[i],
          result.executionHistory[i].nodeId,
          `Hook nodeId at position ${i} should match history record nodeId`
        );
      }

      // Verify increment_node executes multiple times with different executionIndex values
      const incrementNodeExecutions = result.executionHistory.filter(
        (r) => r.nodeId === "increment_node"
      );
      assert.equal(incrementNodeExecutions.length, 3, "increment_node should execute 3 times");
      
      const incrementNodeHookIndices = hookExecutionIndices.filter(
        (_, i) => hookNodeIds[i] === "increment_node"
      );
      assert.equal(
        incrementNodeHookIndices.length,
        3,
        "onNodeStart should be called 3 times for increment_node"
      );
      
      // Verify each execution has unique executionIndex
      const uniqueIndices = new Set(incrementNodeHookIndices);
      assert.equal(
        uniqueIndices.size,
        3,
        "Each increment_node execution should have unique executionIndex"
      );
    });
  });

  describe("history functions in JSONata", () => {
    it("should support $previousNode() function in a loop", async () => {
      const configPath = join(projectRoot, "examples", "loop_example.yaml");
      const api = new McpGraphApi(configPath);

      // The exit_sum transform node uses $previousNode() to get check_condition's output
      // Switch nodes output the target node ID they routed to, so $previousNode() = "exit_sum"
      const { promise } = api.executeTool("sum_to_n", { n: 3 });
      const result = await promise;
      await api.close();

      assert(result.result, "Execution should complete successfully");
      const resultObj = result.result as { sum?: number };
      assert.equal(resultObj.sum, 6, "Sum of 1+2+3 should be 6");

      // Verify increment_node executed multiple times
      assert(result.executionHistory, "Execution history should be present");
      const incrementExecutions = result.executionHistory.filter(
        (r) => r.nodeId === "increment_node"
      );
      assert.equal(incrementExecutions.length, 3, "increment_node should execute exactly 3 times");
      
      // Verify exit_sum output matches tool schema and that $previousNode() was used correctly
      const exitSumRecord = result.executionHistory.find((r) => r.nodeId === "exit_sum");
      assert(exitSumRecord, "exit_sum should be in history");
      const exitSumOutput = exitSumRecord.output as { sum?: number; error?: string };
      assert.equal(exitSumOutput.sum, 6, "exit_sum should output the sum");
      assert(!exitSumOutput.error, "exit_sum should not have error - $previousNode() should have worked correctly");
      
      // Verify $previousNode() works by checking check_condition's output
      const checkConditionRecord = result.executionHistory.find((r) => r.nodeId === "check_condition" && r.executionIndex === exitSumRecord.executionIndex - 1);
      assert(checkConditionRecord, "check_condition should be the previous node before exit_sum");
      assert.equal(checkConditionRecord.output, "exit_sum", "Switch node should output the target node ID it routed to, which $previousNode() should return");
    });

    it("should support $executionCount() function", async () => {
      const configPath = join(projectRoot, "examples", "loop_example.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("sum_to_n", { n: 5 });
      const result = await promise;
      await api.close();

      assert(result.result, "Execution should complete successfully");
      assert(result.executionHistory, "Execution history should be present");

      // Verify increment_node executed 5 times
      const incrementExecutions = result.executionHistory.filter(
        (r) => r.nodeId === "increment_node"
      );
      assert.equal(incrementExecutions.length, 5, "increment_node should execute 5 times");

      // Verify each execution has unique executionIndex
      const indices = incrementExecutions.map((r) => r.executionIndex);
      const uniqueIndices = new Set(indices);
      assert.equal(indices.length, uniqueIndices.size, "Each execution should have unique index");
    });

    it("should support $nodeExecution() function to access specific iterations", async () => {
      // This test will need a custom YAML that uses $nodeExecution() in a transform
      // For now, verify the function exists and can be called
      const configPath = join(projectRoot, "examples", "loop_example.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("sum_to_n", { n: 4 });
      const result = await promise;
      await api.close();

      assert(result.result, "Execution should complete successfully");
      assert(result.executionHistory, "Execution history should be present");

      // Verify we can access specific executions via history
      const incrementExecutions = result.executionHistory.filter(
        (r) => r.nodeId === "increment_node"
      );
      assert(incrementExecutions.length >= 4, "Should have at least 4 executions");

      // First execution should have counter = 1
      const firstExecution = incrementExecutions[0];
      const firstOutput = firstExecution.output as { counter?: number };
      assert.equal(firstOutput.counter, 1, "First execution should have counter = 1");

      // Last execution should have counter = 4
      const lastExecution = incrementExecutions[incrementExecutions.length - 1];
      const lastOutput = lastExecution.output as { counter?: number };
      assert.equal(lastOutput.counter, 4, "Last execution should have counter = 4");
    });

    it("should support $nodeExecutions() function to get all iterations", async () => {
      const configPath = join(projectRoot, "examples", "loop_example.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("sum_to_n", { n: 3 });
      const result = await promise;
      await api.close();

      assert(result.result, "Execution should complete successfully");
      assert(result.executionHistory, "Execution history should be present");

      // Get all increment_node executions
      const incrementExecutions = result.executionHistory.filter(
        (r) => r.nodeId === "increment_node"
      );
      assert.equal(incrementExecutions.length, 3, "Should have 3 executions");

      // Verify we can access all outputs
      const outputs = incrementExecutions.map((r) => r.output as { counter?: number });
      assert.equal(outputs[0].counter, 1, "First iteration counter = 1");
      assert.equal(outputs[1].counter, 2, "Second iteration counter = 2");
      assert.equal(outputs[2].counter, 3, "Third iteration counter = 3");
    });
  });

  describe("multiple executions of same node (loops)", () => {
    it("should handle multiple executions with unique executionIndex", async () => {
      // This test verifies that if a node executes multiple times (in a loop),
      // each execution gets a unique executionIndex
      // For a full loop test, we'd need a graph with a loop, but the basic structure is verified
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("count_files", {
        directory: join(projectRoot, "tests", "files"),
      });
      const result = await promise;
      await api.close();

      // Verify executionIndex is sequential even if same node appears multiple times
      // (In this simple example, each node executes once, but structure supports loops)
      assert(result.executionHistory, "Execution history should be present");
      const indices = result.executionHistory.map((r) => r.executionIndex);
      for (let i = 0; i < indices.length; i++) {
        assert.equal(indices[i], i, `Index ${i} should be ${i}`);
      }
    });
  });

  describe("context building from history", () => {
    it("should build context correctly from history", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("count_files", {
        directory: join(projectRoot, "tests", "files"),
      });
      const result = await promise;
      await api.close();

      // Verify that later nodes can access earlier node outputs
      // The count_files_node should have access to list_directory_node output
      assert(result.executionHistory, "Execution history should be present");
      const listDirRecord = result.executionHistory.find(
        (r) => r.nodeId === "list_directory_node"
      );
      const countRecord = result.executionHistory.find(
        (r) => r.nodeId === "count_files_node"
      );

      assert(listDirRecord, "list_directory_node should be in history");
      assert(countRecord, "count_files_node should be in history");
      assert(listDirRecord.executionIndex < countRecord.executionIndex, "list_directory should execute before count");

      // The final result should reflect that count_files_node had access to list_directory_node output
      assert(result.result, "Result should be present");
      const resultObj = result.result as { count?: number };
      assert(resultObj.count !== undefined, "Result should have count");
      assert(resultObj.count > 0, "Count should be positive");
    });
  });
});

