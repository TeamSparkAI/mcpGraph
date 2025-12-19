# Future: Graph Introspection & Debugging

This document outlines the planned features for graph introspection, debugging, and observability in mcpGraph. These features are designed to support visualizer applications that need to observe, debug, and analyze graph execution.

## Use Case: Visualizer Application

A visualizer application uses mcpGraph to execute graphs and needs:
- **Step-through debugging**: Step into/over nodes, pause/resume execution
- **Breakpoints**: Set breakpoints on specific nodes to pause execution
- **Real-time observation**: See node inputs/outputs during execution
- **Execution history**: View complete execution history after completion
- **Telemetry**: Collect timing, performance metrics, and execution traces
- **State inspection**: Inspect execution context at any point

## Design Goals

1. **Non-intrusive**: Debugging features should not affect normal execution when not in use
2. **Observable**: Full visibility into execution state and data flow
3. **Controllable**: Ability to pause, resume, step, and modify execution
4. **Telemetry-ready**: Structured data for logging, metrics, and tracing

## Proposed API Design

### Execution Hooks

```typescript
interface ExecutionHooks {
  /**
   * Called before a node executes
   * Return false to pause execution (breakpoint)
   */
  onNodeStart?: (nodeId: string, node: NodeDefinition, context: ExecutionContext) => boolean | Promise<boolean>;
  
  /**
   * Called after a node completes successfully
   */
  onNodeComplete?: (nodeId: string, node: NodeDefinition, input: unknown, output: unknown, duration: number) => void | Promise<void>;
  
  /**
   * Called when a node encounters an error
   */
  onNodeError?: (nodeId: string, node: NodeDefinition, error: Error, context: ExecutionContext) => void | Promise<void>;
  
  /**
   * Called when execution pauses (breakpoint hit or manual pause)
   */
  onPause?: (nodeId: string, context: ExecutionContext) => void | Promise<void>;
  
  /**
   * Called when execution resumes
   */
  onResume?: () => void | Promise<void>;
}
```

### Execution Controller

```typescript
interface ExecutionController {
  /**
   * Pause execution at the next node boundary
   */
  pause(): void;
  
  /**
   * Resume execution
   */
  resume(): void;
  
  /**
   * Step to the next node (step over)
   */
  step(): Promise<void>;
  
  /**
   * Step into (if node has sub-execution, otherwise same as step)
   */
  stepInto(): Promise<void>;
  
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
}

interface ExecutionState {
  isRunning: boolean;
  isPaused: boolean;
  currentNodeId: string | null;
  executionHistory: NodeExecutionRecord[];
  context: ExecutionContext;
}

interface NodeExecutionRecord {
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime: number;
  duration: number;
  input: unknown;
  output: unknown;
  error?: Error;
}
```

### Updated GraphExecutor API

```typescript
class GraphExecutor {
  /**
   * Execute with hooks for debugging/observability
   */
  async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    options?: ExecutionOptions
  ): Promise<ExecutionResult>;
}

interface ExecutionOptions {
  hooks?: ExecutionHooks;
  breakpoints?: string[];
  enableTelemetry?: boolean;
}

interface ExecutionResult {
  result: unknown;
  executionHistory: NodeExecutionRecord[];
  telemetry?: ExecutionTelemetry;
}

interface ExecutionTelemetry {
  totalDuration: number;
  nodeDurations: Map<string, number>;
  nodeCounts: Map<string, number>;
  errorCount: number;
}
```

## Implementation Plan

### Phase 1: Execution Hooks

**Goal**: Add hooks for observing execution without breaking existing functionality.

**Changes**:
1. Add `ExecutionHooks` interface
2. Modify `GraphExecutor.executeTool()` to accept optional hooks
3. Call hooks at appropriate points:
   - `onNodeStart` before each node execution
   - `onNodeComplete` after successful node execution
   - `onNodeError` on node errors
4. Ensure hooks are optional and don't affect normal execution

**Files to modify**:
- `src/execution/executor.ts` - Add hooks parameter and calls
- `src/types/execution.ts` - Add hook interfaces (new file)

### Phase 2: Execution History & Telemetry

**Goal**: Track detailed execution history with timing information.

**Changes**:
1. Enhance `ExecutionContext` to track timing:
   - Add `startTime`/`endTime` to history entries
   - Calculate duration for each node
2. Add telemetry collection:
   - Track total execution time
   - Track per-node execution counts and durations
   - Track error counts
3. Return execution history and telemetry in result

**Files to modify**:
- `src/execution/context.ts` - Add timing to history
- `src/execution/executor.ts` - Collect telemetry, return history
- `src/types/execution.ts` - Add telemetry types

### Phase 3: Pause/Resume & Step Control

**Goal**: Enable pausing execution and stepping through nodes.

**Changes**:
1. Add execution state management:
   - Track if execution is paused
   - Track current node
   - Queue for resume/step commands
2. Implement pause/resume:
   - `pause()` sets flag, execution pauses at next node boundary
   - `resume()` clears flag, execution continues
3. Implement step control:
   - `step()` executes one node then pauses
   - Requires async execution with promise-based control

**Files to modify**:
- `src/execution/executor.ts` - Add pause/resume/step logic
- `src/execution/controller.ts` - New file for execution control
- `src/types/execution.ts` - Add controller interfaces

### Phase 4: Breakpoints

**Goal**: Support setting breakpoints on specific nodes.

**Changes**:
1. Add breakpoint management:
   - Store set of node IDs with breakpoints
   - Check breakpoints before node execution
   - Trigger pause when breakpoint hit
2. Integrate with hooks:
   - `onNodeStart` can check breakpoints
   - Return false from hook to pause

**Files to modify**:
- `src/execution/executor.ts` - Add breakpoint checking
- `src/execution/controller.ts` - Add breakpoint management

### Phase 5: State Inspection

**Goal**: Allow inspection of execution state at any point.

**Changes**:
1. Expose execution state:
   - Current node ID
   - Execution history
   - Current context data
   - Execution status (running/paused/complete)
2. Add public API methods:
   - `getCurrentState()` - Get current execution state
   - `getNodeOutput(nodeId)` - Get output of specific node
   - `getContextData()` - Get current context data

**Files to modify**:
- `src/execution/executor.ts` - Add state inspection methods
- `src/execution/context.ts` - Add methods to query context

## API Usage Example

```typescript
import { McpGraphApi } from 'mcpgraph';

const api = new McpGraphApi('config.yaml');

// Execute with debugging hooks
const result = await api.executeTool('count_files', {
  directory: './tests/files'
}, {
  hooks: {
    onNodeStart: async (nodeId, node, context) => {
      console.log(`Starting node: ${nodeId}`);
      // Return false to pause (breakpoint)
      return nodeId !== 'breakpoint_node';
    },
    onNodeComplete: async (nodeId, node, input, output, duration) => {
      console.log(`Node ${nodeId} completed in ${duration}ms`);
      // Visualizer can update UI here
    },
    onNodeError: async (nodeId, node, error, context) => {
      console.error(`Node ${nodeId} error:`, error);
    }
  },
  breakpoints: ['list_directory_node'],
  enableTelemetry: true
});

// Access execution history
console.log('Execution history:', result.executionHistory);
console.log('Telemetry:', result.telemetry);
```

## Integration with Visualizer

The visualizer application can:
1. **Real-time updates**: Use `onNodeStart`/`onNodeComplete` hooks to update UI as nodes execute
2. **Debugging**: Set breakpoints, pause execution, inspect state
3. **Stepping**: Step through nodes one at a time
4. **History visualization**: Display execution history with timing
5. **Telemetry display**: Show performance metrics and execution statistics

## Backward Compatibility

All new features are optional:
- Hooks are optional parameters
- Normal execution continues to work without hooks
- No breaking changes to existing API
- Telemetry only collected if enabled

## Future Enhancements

- **Conditional breakpoints**: Break when expression evaluates to true
- **Watch expressions**: Monitor specific values during execution
- **State modification**: Modify context data during paused execution
- **Replay execution**: Replay execution history
- **Execution comparison**: Compare multiple execution runs
- **Performance profiling**: Identify slow nodes
- **OpenTelemetry integration**: Export traces to observability platforms

