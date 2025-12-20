# Graph Introspection & Debugging

This document explains how to use mcpGraph's introspection and debugging features to build visualizer applications, debuggers, and observability tools.

## Overview

mcpGraph provides comprehensive introspection and debugging capabilities that allow you to:

- **Observe execution in real-time** using execution hooks
- **Control execution flow** with pause, resume, and step operations
- **Set breakpoints** on specific nodes
- **Collect telemetry** including timing and performance metrics
- **Inspect execution state** at any point during execution
- **Access execution history** with detailed timing information

All debugging features are **non-intrusive** - they only activate when explicitly enabled, ensuring normal execution remains unaffected.

## Quick Start

```typescript
import { McpGraphApi, type ExecutionHooks } from 'mcpgraph';

const api = new McpGraphApi('config.yaml');

// Execute with debugging enabled - controller is available immediately
const { promise, controller } = api.executeTool('count_files', {
  directory: './tests/files'
}, {
  hooks: {
    onNodeStart: async (nodeId, node) => {
      console.log(`Starting node: ${nodeId} (${node.type})`);
    },
    onNodeComplete: async (nodeId, node, input, output, duration) => {
      console.log(`Node ${nodeId} completed in ${duration}ms`);
    }
  },
  enableTelemetry: true
});

// Controller is available immediately (no polling needed)
if (controller) {
  console.log('Controller available for pause/resume/stop');
}

// Wait for execution to complete
const result = await promise;

// Access execution history and telemetry
console.log('History:', result.executionHistory);
console.log('Telemetry:', result.telemetry);
```

## Execution Hooks

Execution hooks allow you to observe and control execution at key points. All hooks are optional and are async functions. If you don't need to perform async operations, you can simply not use `await` - the function will still work correctly.

### Available Hooks

All hooks are async functions that return Promises:

```typescript
interface ExecutionHooks {
  /**
   * Called before a node executes
   * Return false to pause execution (acts as a breakpoint)
   */
  onNodeStart?: (
    nodeId: string,
    node: NodeDefinition,
    context: ExecutionContext
  ) => Promise<boolean>;
  
  /**
   * Called after a node completes successfully
   */
  onNodeComplete?: (
    nodeId: string,
    node: NodeDefinition,
    input: unknown,
    output: unknown,
    duration: number
  ) => Promise<void>;
  
  /**
   * Called when a node encounters an error
   */
  onNodeError?: (
    nodeId: string,
    node: NodeDefinition,
    error: Error,
    context: ExecutionContext
  ) => Promise<void>;
  
  /**
   * Called when execution pauses (breakpoint hit or manual pause)
   */
  onPause?: (nodeId: string, context: ExecutionContext) => Promise<void>;
  
  /**
   * Called when execution resumes
   */
  onResume?: () => Promise<void>;
}
```

### Example: Real-time UI Updates

All hooks are async functions. If you don't need async operations, you can simply not use `await`:

```typescript
const hooks: ExecutionHooks = {
  // Async function - no await needed if you don't have async operations
  onNodeStart: async (nodeId, node, context) => {
    // Update UI synchronously
    updateNodeStatus(nodeId, 'running');
    highlightNode(nodeId);
    return true; // Continue execution
  },
  
  // Async function - can use await if needed
  onNodeComplete: async (nodeId, node, input, output, duration) => {
    // Update UI synchronously
    updateNodeResult(nodeId, {
      input,
      output,
      duration,
      status: 'completed'
    });
    updateNodeVisualization(nodeId, output);
    
    // Or perform async operations if needed
    // await logToServer(nodeId, output);
  },
  
  onNodeError: async (nodeId, node, error, context) => {
    // Error handling
    showError(nodeId, error);
    updateNodeStatus(nodeId, 'error');
  }
};

await api.executeTool('my_tool', {}, { hooks });
```

## Execution Controller

The execution controller provides programmatic control over execution flow. It's available during execution when hooks or breakpoints are enabled.

### Getting the Controller

```typescript
// Start execution with hooks/breakpoints - controller is available immediately
const { promise: executionPromise, controller } = api.executeTool('my_tool', {}, {
  hooks: { /* ... */ },
  breakpoints: ['node_1', 'node_2']
});

// Controller is available immediately (no polling needed)
if (controller) {
  // Use controller methods
  controller.pause();
  controller.resume();
  await controller.step();
}
```

### Controller Methods

```typescript
interface ExecutionController {
  /**
   * Pause execution at the next node boundary
   * Only valid when status is "running"
   */
  pause(): void;
  
  /**
   * Resume execution
   * Only valid when status is "paused"
   */
  resume(): void;
  
  /**
   * Step to the next node (step over)
   * Only valid when status is "paused"
   */
  step(): Promise<void>;
  
  /**
   * Get current execution state
   */
  getState(): ExecutionState;
  
  /**
   * Set breakpoints
   */
  setBreakpoints(nodeIds: string[]): void;
  
  /**
   * Clear breakpoints
   */
  clearBreakpoints(): void;
  
  /**
   * Stop/cancel the ongoing execution.
   * Only valid when status is "running" or "paused"
   * Immediately halts execution at the current node boundary.
   */
  stop(): void;
}
```

### Example: Step-through Debugging

```typescript
const hooks: ExecutionHooks = {
  onPause: async (nodeId, context) => {
    console.log(`Paused at node: ${nodeId}`);
    // Show debugger UI
    showDebuggerUI();
  },
  onResume: async () => {
    console.log('Resuming execution');
    hideDebuggerUI();
  }
};

// Start execution in paused state - controller is available immediately
const { promise: executionPromise, controller } = api.executeTool('my_tool', {}, {
  hooks,
  startPaused: true, // Start paused at entry node for step-through debugging
});

// In your UI event handlers (controller is available immediately):
function handleStep() {
  if (controller) {
    await controller.step();
  }
}

function handlePause() {
  if (controller) {
    controller.pause();
  }
}

function handleResume() {
  if (controller) {
    controller.resume();
  }
}

function handleStop() {
  if (controller) {
    controller.stop();
  }
}
```

## Breakpoints

Breakpoints allow you to pause execution at specific nodes. You can set breakpoints in two ways:

### 1. Via Execution Options

```typescript
await api.executeTool('my_tool', {}, {
  breakpoints: ['node_1', 'node_2', 'node_3']
});
```

### 2. Via Execution Controller

```typescript
// Get controller from executeTool return value
const { controller } = api.executeTool('my_tool', {}, {
  hooks: { /* ... */ }
});

if (controller) {
  // Set breakpoints dynamically
  controller.setBreakpoints(['node_1', 'node_2']);
  
  // Clear all breakpoints
  controller.clearBreakpoints();
}
```

### 3. Via onNodeStart Hook

```typescript
const hooks: ExecutionHooks = {
  onNodeStart: async (nodeId, node, context) => {
    // Conditional breakpoint logic
    if (shouldBreak(nodeId, context)) {
      return false; // Pause execution
    }
    return true; // Continue
  }
};
```

## Execution State

The execution state provides a snapshot of the current execution status, including:

- **Status**: Current execution status (`not_started`, `running`, `paused`, `finished`, `error`)
- **Current Node**: The node currently executing (or null)
- **Execution History**: Complete history of all executed nodes
- **Context**: The current execution context with all data

### Getting Execution State

```typescript
// During execution
const state = api.getExecutionState();
if (state) {
  console.log('Status:', state.status);
  console.log('Current Node:', state.currentNodeId);
  console.log('History:', state.executionHistory);
  console.log('Context:', state.context.getData());
}

// Or via controller (from executeTool return value)
const { controller } = api.executeTool('my_tool', {}, {
  hooks: { /* ... */ }
});

if (controller) {
  const state = controller.getState();
  // Same state object
}
```

### Execution Status

```typescript
type ExecutionStatus = 
  | "not_started"  // Execution hasn't begun
  | "running"      // Execution is actively running
  | "paused"       // Execution is paused (can resume/step)
  | "finished"     // Execution completed successfully
  | "error"        // Execution failed with an error
  | "stopped";     // Execution was stopped/cancelled
```

### Execution State Interface

```typescript
interface ExecutionState {
  status: ExecutionStatus;
  currentNodeId: string | null;
  executionHistory: NodeExecutionRecord[];
  context: ExecutionContext;
  error?: Error; // Present when status is "error"
}
```

## Execution History

Execution history provides a complete record of all node executions with detailed timing information.

### History Record Structure

```typescript
interface NodeExecutionRecord {
  executionIndex: number;  // Position in overall execution history (0, 1, 2, ...) - unique identifier
  nodeId: string;           // ID of the executed node
  nodeType: string;         // Type of node (entry, exit, transform, mcp, switch)
  startTime: number;        // Timestamp when node started (milliseconds)
  endTime: number;          // Timestamp when node ended (milliseconds)
  duration: number;         // Execution duration (milliseconds)
  output: unknown;          // Output data from the node
  error?: Error;            // Error object if node failed
}
```

**Note**: The `input` field has been removed. Input context can be derived by building context from history up to the execution index using `getContextForExecution(executionIndex)`.

### Accessing History

```typescript
// From execution result
const result = await api.executeTool('my_tool', {}, {
  enableTelemetry: true
});

for (const record of result.executionHistory || []) {
  console.log(`${record.nodeId}: ${record.duration}ms`);
  if (record.error) {
    console.error(`Error: ${record.error.message}`);
  }
}

// From execution state (during execution)
const state = api.getExecutionState();
if (state) {
  const history = state.executionHistory;
  // Access history during execution
}
```

### Time-Travel Debugging

You can get the context that was available to a specific execution using `getContextForExecution()`:

```typescript
// Get context for a specific execution
const context = api.getContextForExecution(5);
if (context) {
  console.log('Context available to execution #5:', context);
}

// Get a specific execution record
const record = api.getExecutionByIndex(5);
if (record) {
  console.log(`Execution #5: ${record.nodeId} executed at ${record.startTime}`);
  console.log(`Output:`, record.output);
  
  // Get the context that was available to this execution
  const inputContext = api.getContextForExecution(record.executionIndex);
  console.log('Input context:', inputContext);
}
```

**Note**: Both methods require an active execution with a controller (hooks/breakpoints enabled). They return `null` if no execution is in progress or the index is invalid.

## Telemetry

Telemetry provides aggregated performance metrics and execution statistics.

### Telemetry Structure

```typescript
interface ExecutionTelemetry {
  totalDuration: number;              // Total execution time (milliseconds)
  nodeDurations: Map<string, number>; // Total duration per node type
  nodeCounts: Map<string, number>;     // Execution count per node type
  errorCount: number;                  // Total number of errors
}
```

### Collecting Telemetry

```typescript
const result = await api.executeTool('my_tool', {}, {
  enableTelemetry: true // Enable telemetry collection
});

if (result.telemetry) {
  console.log(`Total duration: ${result.telemetry.totalDuration}ms`);
  console.log(`Errors: ${result.telemetry.errorCount}`);
  
  // Node type statistics
  for (const [nodeType, duration] of result.telemetry.nodeDurations) {
    const count = result.telemetry.nodeCounts.get(nodeType) || 0;
    console.log(`${nodeType}: ${count} executions, ${duration}ms total`);
  }
}
```

### Example: Performance Analysis

```typescript
function analyzePerformance(telemetry: ExecutionTelemetry) {
  const avgDurations = new Map<string, number>();
  
  for (const [nodeType, totalDuration] of telemetry.nodeDurations) {
    const count = telemetry.nodeCounts.get(nodeType) || 1;
    const avgDuration = totalDuration / count;
    avgDurations.set(nodeType, avgDuration);
  }
  
  // Find slowest node types
  const sorted = Array.from(avgDurations.entries())
    .sort((a, b) => b[1] - a[1]);
  
  console.log('Slowest node types:');
  for (const [nodeType, avgDuration] of sorted) {
    console.log(`  ${nodeType}: ${avgDuration.toFixed(2)}ms average`);
  }
}
```

## Complete Example: Visualizer Application

Here's a complete example of how to build a visualizer application:

```typescript
import { McpGraphApi, type ExecutionHooks, type ExecutionState } from 'mcpgraph';

class GraphVisualizer {
  private api: McpGraphApi;
  private executionPromise: Promise<any> | null = null;
  
  constructor(configPath: string) {
    this.api = new McpGraphApi(configPath);
  }
  
  async executeWithVisualization(toolName: string, args: Record<string, unknown>) {
    const hooks: ExecutionHooks = {
      onNodeStart: async (nodeId, node, context) => {
        this.updateNodeStatus(nodeId, 'running');
        this.highlightNode(nodeId);
        return true;
      },
      
      onNodeComplete: async (nodeId, node, input, output, duration) => {
        this.updateNodeStatus(nodeId, 'completed');
        this.updateNodeData(nodeId, { input, output, duration });
        this.unhighlightNode(nodeId);
      },
      
      onNodeError: async (nodeId, node, error, context) => {
        this.updateNodeStatus(nodeId, 'error');
        this.showError(nodeId, error);
      },
      
      onPause: async (nodeId, context) => {
        this.showDebuggerControls();
        this.updateExecutionStatus('paused');
      },
      
      onResume: async () => {
        this.hideDebuggerControls();
        this.updateExecutionStatus('running');
      }
    };
    
    this.executionPromise = this.api.executeTool(toolName, args, {
      hooks,
      enableTelemetry: true
    });
    
    const result = await this.executionPromise;
    this.executionPromise = null;
    
    // Display results
    this.displayHistory(result.executionHistory || []);
    this.displayTelemetry(result.telemetry);
    
    return result;
  }
  
  pause() {
    if (this.controller) {
      this.controller.pause();
    }
  }
  
  resume() {
    if (this.controller) {
      this.controller.resume();
    }
  }
  
  async step() {
    const controller = this.api.getController();
    if (controller) {
      await controller.step();
    }
  }
  
  stop() {
    if (this.controller) {
      this.controller.stop();
    }
  }
  
  setBreakpoints(nodeIds: string[]) {
    const controller = this.api.getController();
    if (controller) {
      controller.setBreakpoints(nodeIds);
    }
  }
  
  getCurrentState(): ExecutionState | null {
    return this.api.getExecutionState();
  }
  
  // UI update methods (implement based on your UI framework)
  private updateNodeStatus(nodeId: string, status: string) { /* ... */ }
  private highlightNode(nodeId: string) { /* ... */ }
  private unhighlightNode(nodeId: string) { /* ... */ }
  private updateNodeData(nodeId: string, data: any) { /* ... */ }
  private showError(nodeId: string, error: Error) { /* ... */ }
  private showDebuggerControls() { /* ... */ }
  private hideDebuggerControls() { /* ... */ }
  private updateExecutionStatus(status: string) { /* ... */ }
  private displayHistory(history: any[]) { /* ... */ }
  private displayTelemetry(telemetry: any) { /* ... */ }
}
```

## API Reference

### McpGraphApi Methods

```typescript
class McpGraphApi {
  /**
   * Execute a tool with optional debugging options
   * Returns both the execution promise and controller (if hooks/breakpoints/startPaused are provided)
   * Controller is available immediately - no polling needed
   */
  executeTool(
    toolName: string,
    toolArguments: Record<string, unknown>,
    options?: ExecutionOptions
  ): { promise: Promise<ExecutionResult>; controller: ExecutionController | null };
  
  /**
   * Get the execution controller (available during execution)
   * @deprecated Use the controller returned from executeTool() instead
   */
  getController(): ExecutionController | null;
  
  /**
   * Get the current execution state (if execution is in progress)
   */
  getExecutionState(): ExecutionState | null;
  
  /**
   * Get the graph structure
   */
  getGraph(): Graph;
  
  /**
   * Get the full configuration
   */
  getConfig(): McpGraphConfig;
}
```

### ExecutionOptions

```typescript
interface ExecutionOptions {
  hooks?: ExecutionHooks;      // Execution hooks for observation/control
  breakpoints?: string[];      // Node IDs to pause at
  enableTelemetry?: boolean;   // Enable telemetry collection
  startPaused?: boolean;       // Start execution in paused state (pauses at entry node)
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  result: unknown;                          // The tool's result
  structuredContent?: Record<string, unknown>; // Structured result (for MCP)
  executionHistory?: NodeExecutionRecord[];    // Execution history
  telemetry?: ExecutionTelemetry;              // Performance telemetry
}
```

## Type Exports

All types are exported from the main package:

```typescript
import {
  McpGraphApi,
  type ExecutionHooks,
  type ExecutionController,
  type ExecutionState,
  type ExecutionStatus,
  type ExecutionOptions,
  type ExecutionResult,
  type NodeExecutionRecord,
  type ExecutionTelemetry,
  type NodeDefinition,
  type McpGraphConfig
} from 'mcpgraph';
```

## Best Practices

1. **Enable telemetry only when needed**: Telemetry collection adds overhead, so only enable it when you need performance metrics.

2. **Use hooks for real-time updates**: Hooks are perfect for updating UI in real-time as execution progresses.

3. **All hooks are async**: All hooks are async functions. If you don't need to perform async operations, you can simply not use `await` - the function will still work correctly. This provides consistency and allows you to add async operations later without changing the function signature.

4. **Clean up after execution**: The controller is automatically cleaned up after execution completes, but you should check for `null` when accessing it.

5. **Check execution state before operations**: Always verify that execution is in the correct state before calling controller methods (e.g., don't call `resume()` when status is `"running"`).

6. **Use breakpoints for debugging**: Breakpoints are more efficient than conditional logic in hooks for simple pause-on-node scenarios.

## Limitations

- **Controller availability**: The controller is only available during execution when hooks or breakpoints are enabled. After execution completes, it's cleaned up.


- **State modification**: You cannot modify execution context during paused execution (this may be added in future versions).

- **Concurrent executions**: Each `McpGraphApi` instance supports one execution at a time. For concurrent executions, create multiple instances.

## Future Enhancements

Planned enhancements include:

- Conditional breakpoints (break when expression evaluates to true)
- Watch expressions (monitor specific values during execution)
- State modification during paused execution
- Execution replay from history
- Execution comparison (compare multiple runs)
- OpenTelemetry integration for distributed tracing


