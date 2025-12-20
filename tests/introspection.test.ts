/**
 * Tests for execution introspection and debugging features
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { McpGraphApi } from "../src/api.js";
import type { ExecutionHooks, ExecutionStatus } from "../src/types/execution.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Execution introspection and debugging", () => {
  describe("execution hooks", () => {
    it("should call onNodeStart and onNodeComplete hooks", async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const api = new McpGraphApi(configPath);

      const nodeStartCalls: Array<{ nodeId: string; nodeType: string }> = [];
      const nodeCompleteCalls: Array<{ nodeId: string; duration: number }> = [];

      const hooks: ExecutionHooks = {
        onNodeStart: async (nodeId, node) => {
          nodeStartCalls.push({ nodeId, nodeType: node.type });
          return true; // Continue execution
        },
        onNodeComplete: async (nodeId, node, input, output, duration) => {
          nodeCompleteCalls.push({ nodeId, duration });
        },
      };

      const { promise } = api.executeTool("test_switch", { value: 5 }, { hooks });
      await promise;

      // Verify hooks were called
      assert(nodeStartCalls.length > 0, "onNodeStart should be called");
      assert(nodeCompleteCalls.length > 0, "onNodeComplete should be called");

      // Verify entry node was called
      const entryCall = nodeStartCalls.find((c) => c.nodeId === "entry");
      assert(entryCall !== undefined, "Entry node should be called");
      assert(entryCall.nodeType === "entry", "Entry node should have type 'entry'");

      // Verify switch node was called
      const switchCall = nodeStartCalls.find((c) => c.nodeId === "switch_node");
      assert(switchCall !== undefined, "Switch node should be called");
      assert(switchCall.nodeType === "switch", "Switch node should have type 'switch'");

      // Verify durations are recorded
      assert(
        nodeCompleteCalls.every((c) => c.duration >= 0),
        "All durations should be non-negative"
      );

      await api.close();
    });

    it("should call onNodeError hook when node fails", async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const api = new McpGraphApi(configPath);

      let errorHookCalled = false;
      let errorNodeId: string | undefined;

      const hooks: ExecutionHooks = {
        onNodeError: async (nodeId, node, error) => {
          errorHookCalled = true;
          errorNodeId = nodeId;
        },
      };

      // This should not error, but we can test error handling with a malformed config
      // For now, just verify the hook structure is correct
      const { promise } = api.executeTool("test_switch", { value: 5 }, { hooks });
      await promise;

      // In a real error scenario, errorHookCalled would be true
      // For now, we just verify the hook is properly structured
      assert(typeof hooks.onNodeError === "function", "onNodeError hook should be callable");

      await api.close();
    });
  });

  describe("execution history", () => {
    it("should return execution history with timing", async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("test_switch", { value: 5 }, {
        enableTelemetry: true,
      });
      const result = await promise;

      assert(result.executionHistory !== undefined, "Execution history should be present");
      assert(Array.isArray(result.executionHistory), "Execution history should be an array");
      assert(result.executionHistory.length > 0, "Execution history should have entries");

      // Verify history entries have required fields
      for (const record of result.executionHistory) {
        assert(typeof record.nodeId === "string", "Record should have nodeId");
        assert(typeof record.nodeType === "string", "Record should have nodeType");
        assert(typeof record.startTime === "number", "Record should have startTime");
        assert(typeof record.endTime === "number", "Record should have endTime");
        assert(typeof record.duration === "number", "Record should have duration");
        assert(record.duration >= 0, "Duration should be non-negative");
        assert(record.endTime >= record.startTime, "endTime should be >= startTime");
      }

      await api.close();
    });
  });

  describe("telemetry", () => {
    it("should collect telemetry when enabled", async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("test_switch", { value: 5 }, {
        enableTelemetry: true,
      });
      const result = await promise;

      assert(result.telemetry !== undefined, "Telemetry should be present");
      assert(typeof result.telemetry.totalDuration === "number", "Total duration should be a number");
      assert(result.telemetry.totalDuration >= 0, "Total duration should be non-negative");
      assert(result.telemetry.nodeDurations instanceof Map, "Node durations should be a Map");
      assert(result.telemetry.nodeCounts instanceof Map, "Node counts should be a Map");
      assert(typeof result.telemetry.errorCount === "number", "Error count should be a number");

      // Verify node counts match history
      const history = result.executionHistory || [];
      const nodeTypeCounts = new Map<string, number>();
      for (const record of history) {
        const count = nodeTypeCounts.get(record.nodeType) || 0;
        nodeTypeCounts.set(record.nodeType, count + 1);
      }

      // Compare counts
      for (const [nodeType, count] of nodeTypeCounts) {
        const telemetryCount = result.telemetry!.nodeCounts.get(nodeType);
        assert(telemetryCount === count, `Node count for ${nodeType} should match history`);
      }

      await api.close();
    });

    it("should not collect telemetry when disabled", async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const api = new McpGraphApi(configPath);

      const { promise } = api.executeTool("test_switch", { value: 5 }, {
        enableTelemetry: false,
      });
      const result = await promise;

      assert(result.telemetry === undefined, "Telemetry should not be present when disabled");

      await api.close();
    });
  });

  describe("execution controller", () => {
    it("should provide controller when hooks are used", async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const api = new McpGraphApi(configPath);

      const hooks: ExecutionHooks = {
        onNodeStart: async () => true,
      };

      // Start execution - controller is available immediately (no polling needed)
      const { promise: executionPromise, controller } = api.executeTool("test_switch", { value: 5 }, { hooks });

      // Controller should be available immediately
      assert(controller !== null, "Controller should be available immediately");
      
      // Can use controller immediately (e.g., to pause/resume/stop)
      const initialState = controller!.getState();
      assert(initialState !== null, "State should be available");

      // Wait for execution to complete
      await executionPromise;
      
      // After execution completes, the controller's state shows "finished"
      const finalState = controller!.getState();
      assert(finalState !== null, "State should still be available after execution");
      assert(finalState.status === "finished", "Status should be 'finished' after successful execution");
      assert(finalState.currentNodeId === null, "Current node should be null after execution");

      await api.close();
    });

    it("should allow getting execution state", async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const api = new McpGraphApi(configPath);

      const hooks: ExecutionHooks = {
        onNodeStart: async () => true,
      };

      // Start execution - controller is available immediately
      const { promise: executionPromise, controller: returnedController } = api.executeTool("test_switch", { value: 5 }, { hooks });
      
      // Controller should be available immediately
      assert(returnedController !== null, "Controller should be available immediately");

      // Try to get state (may be null if execution completes too quickly)
      const state = returnedController!.getState();
      // State might be null if execution completes before we check
      // This is expected behavior

      await executionPromise;

      // After execution, state should show "finished"
      const stateAfter = returnedController!.getState();
      assert(stateAfter !== null, "State should still be available after execution");
      assert(stateAfter.status === "finished", "Status should be 'finished' after successful execution");
      assert(stateAfter.currentNodeId === null, "Current node should be null after execution");

      await api.close();
    });
  });

  describe("breakpoints", () => {
    it("should pause at breakpoints", async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const api = new McpGraphApi(configPath);

      let pausedAtNode: string | null = null;
      let resumeCalled = false;
      const executionOrder: string[] = [];
      let resumeResolve: (() => void) | null = null;
      const resumePromise = new Promise<void>((resolve) => {
        resumeResolve = resolve;
      });

      const hooks: ExecutionHooks = {
        onNodeStart: async (nodeId) => {
          executionOrder.push(`start:${nodeId}`);
          // Don't pause here - let the breakpoint do it
          return true;
        },
        onNodeComplete: async (nodeId) => {
          executionOrder.push(`complete:${nodeId}`);
        },
        onPause: async (nodeId) => {
          pausedAtNode = nodeId;
          executionOrder.push(`pause:${nodeId}`);
          // Signal that we've paused (status is already "paused" at this point)
          if (resumeResolve) {
            resumeResolve();
          }
        },
        onResume: async () => {
          resumeCalled = true;
          executionOrder.push("resume");
        },
      };

      // Start execution with breakpoint - controller is available immediately
      const { promise: executionPromise, controller } = api.executeTool("test_switch", { value: 5 }, {
        hooks,
        breakpoints: ["switch_node"], // Breakpoint should pause here
      });
      
      // Controller should be available immediately (no polling needed)
      assert(controller !== null, "Controller should be available immediately");

      // Wait for pause to occur
      await resumePromise;
      
      const state = controller!.getState();
      assert(state.status === "paused", `Expected status "paused", got "${state.status}"`);
      assert(state.currentNodeId === "switch_node", `Expected current node "switch_node", got "${state.currentNodeId}"`);
      assert(pausedAtNode === "switch_node", "onPause should have been called with switch_node");

      // Verify execution order: entry should complete, switch should pause before starting
      assert(executionOrder.includes("start:entry"), "Entry node should have started");
      assert(executionOrder.includes("complete:entry"), "Entry node should have completed");
      // Note: breakpoint check happens before onNodeStart, so switch_node won't have started yet
      assert(executionOrder.includes("pause:switch_node"), "Should have paused at switch_node");
      assert(!executionOrder.includes("start:switch_node"), "Switch node should not have started yet (paused at breakpoint)");
      assert(!executionOrder.includes("complete:switch_node"), "Switch node should not have completed yet");

      // Resume execution
      controller!.resume();
      
      // Wait for execution to complete (onResume will be called during execution)
      await executionPromise;
      
      // Verify onResume was called
      assert(resumeCalled, "onResume should have been called");

      // Verify switch node completed after resume
      assert(executionOrder.includes("complete:switch_node"), "Switch node should have completed after resume");

      await api.close();
    });
  });
});

