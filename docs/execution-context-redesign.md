# Execution Context & History Redesign

## Rationale

The current execution context design has several limitations that become apparent when considering loops, debugging, and observability:

### Current Issues

1. **No execution history**: Only current context is maintained; no record of past executions
2. **Previous node tracking is a hack**: Tracked separately (`previousNodeId`) instead of being derived from history
3. **Loops overwrite data**: Same node executing multiple times overwrites previous outputs in context
4. **Context structure doesn't distinguish iterations**: Using node ID as key doesn't handle multiple executions of the same node
5. **Can't reconstruct historical context**: No way to see what context was available to a node at the time it executed (for debugging)

### Goals

1. **Single source of truth**: Execution history should be the authoritative record
2. **Handle loops gracefully**: Multiple executions of the same node should be accessible
3. **Derive previous node from history**: No separate tracking needed
4. **Time-travel debugging**: Reconstruct context at any point in execution
5. **Powerful JSONata access**: Access all executions, not just latest
6. **Backward compatibility**: Existing expressions should continue to work

## Current Implementation

### What We Have Now

- **Execution History**: `NodeExecutionRecord[]` stored in `ExecutionContext`
  - Each record: `nodeId`, `nodeType`, `startTime`, `endTime`, `duration`, `input`, `output`, `error`
  - Used for telemetry and debugging hooks

- **Current Context**: Separate `data` object keyed by node ID
  - `this.data[nodeId] = output` (overwrites on loops)
  - Used for JSONata/JSON Logic evaluation

- **Previous Node Tracking**: Separate `previousNodeId` variable passed around

### Problems

1. **Redundancy**: Both history and context store node outputs
2. **Input storage**: Storing `input` (full context) is redundant - can be derived from history
3. **Loop handling**: Context overwrites, history has multiple records but can't distinguish them
4. **Previous node**: Tracked separately instead of derived from history

## Proposed Design

### Core Insight

**If execution is sequential (no parallelism), the execution history is just an ordered array of node executions where:**
- Each execution's input is the context built from all previous executions
- Previous node is just `history[index - 1]`
- Context is built from history once per node execution (when node starts)
- History is the single source of truth

### Execution History Structure

**Structure:**
```typescript
interface NodeExecutionRecord {
  executionIndex: number;  // Position in overall execution history (0, 1, 2, ...) - unique identifier
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime: number;
  duration: number;
  output: unknown;    // Only store output, derive input from history
  error?: Error;
}

class ExecutionContext {
  private history: NodeExecutionRecord[] = [];
  
  getData(): Record<string, unknown> {
    // Build context from history - called once per node execution
    // The context is built when the node starts and used throughout its execution
    return this.buildContextFromHistory();
  }
  
  getPreviousNode(currentIndex: number): NodeExecutionRecord | null {
    return currentIndex > 0 ? this.history[currentIndex - 1] : null;
  }
}
```

**Key Points:**
- History array is the single source of truth
- No separate `data` object
- No `input` field in records (derivable from history)
- Context built fresh from history once per node execution
- Previous node derived from history index

### Context Structure for JSONata Access

We use a **flat context structure** with **history access functions**:

**Context Building:**
```typescript
private buildContextFromHistory(): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  // Walk backwards, most recent execution of each node wins
  for (let i = this.history.length - 1; i >= 0; i--) {
    const record = this.history[i];
    if (!(record.nodeId in context)) {
      context[record.nodeId] = record.output;
    }
  }
  return context;
}
```

**Example Context Object:**
```json
{
  "entry_count_files": { "directory": "/path/to/dir" },
  "list_directory_node": "[FILE] file1.txt\n[FILE] file2.txt",
  "count_files_node": { "count": 2 }
}
```

**If same node executes multiple times (loop):**
```json
{
  "entry_loop": { "value": 0 },
  "increment_node": { "value": 3 }  // Only latest execution
}
```

**JSONata Access:**
- `$.node_name` → latest output (backward compatible, simple notation)
- `$.node_name.foo` → property access

**Custom JSONata Functions (access history directly):**
- `$previousNode()` → previous node's output (from history)
- `$previousNode(index)` → node that executed N steps before current
- `$executionCount(nodeName)` → count of executions for a node
- `$nodeExecution(nodeName, index)` → specific execution by index (0 = first, -1 = last)
- `$nodeExecutions(nodeName)` → array of all executions for a node

**Example Usage:**
```jsonata
// Get previous node's output
$previousNode()

// Get execution count
$executionCount("increment_node")  // Returns 3 if executed 3 times

// Get first execution
$nodeExecution("increment_node", 0)  // Returns { "value": 1 }

// Get all executions
$nodeExecutions("increment_node")  // Returns [{ "value": 1 }, { "value": 2 }, { "value": 3 }]

// Get second-to-last execution
$nodeExecution("increment_node", -2)  // Returns { "value": 2 }
```

**Implementation Note:**
Functions receive the execution history array and current execution index as parameters, allowing them to query history directly without exposing it in the context structure.

**Benefits:**
- Simple, flat context structure (backward compatible)
- Fast to build
- Clean notation: `$.node_name` for latest
- History access is explicit and clear
- No namespace conflicts (no special keys in context)
- Functions can provide powerful queries beyond simple data access
- History queries are separate from context structure

## Design Decisions

### Input Storage

**Decision**: Don't store `input` in `NodeExecutionRecord` - derive from history when needed.

**Rationale**: No redundancy, can always derive input by building context from history up to that point.

### Previous Node Resolution

**Decision**: `$previousNode()` is a custom JSONata function that queries the history array.

**Rationale**: Cleaner, more flexible, and keeps history access explicit.

### Entry Node Handling

**Decision**: Entry node's input is the tool input. When building context for the entry node, tool input is available as the entry node's output (stored in history).

**Rationale**: Consistent with other nodes - tool input is the input to the entry node.

### Execution Index

**Decision**: Add `executionIndex` field to `NodeExecutionRecord` to uniquely identify each execution.

**Rationale**: 
- Provides a unique identifier for each execution (even when same node executes multiple times)
- Enables API endpoints to reference specific executions (e.g., "get context for execution at index 5")
- Makes it easy for debuggers to reference and query specific executions
- The index represents the position in the overall execution history array (0, 1, 2, ...)

## Implementation Plan

### Phase 1: Refactor ExecutionContext

1. Remove `data` object, keep only `history`
2. Remove `input` from `NodeExecutionRecord` (derive from history)
3. Add `executionIndex` to `NodeExecutionRecord` (set when adding to history)
4. Implement `buildContextFromHistory(upToIndex?: number)` method:
   - If `upToIndex` is provided, build context from history up to that index (for debugging)
   - If not provided, build context from entire history (for current execution)
5. Update `getData()` to build context from history once per node execution

### Phase 2: Update Node Executors

1. Remove `previousNodeId` parameter from all node executors
2. Update `addHistory()` to include `executionIndex` (current history length)
3. Update `addHistory()` calls to not pass `input` (or derive it)
4. Update exit node to get previous node from history instead of `previousNodeId`

### Phase 3: Update Expression Evaluation

1. Context stays flat - no changes needed to context structure
2. Add custom JSONata functions that receive history and current index:
   - `$previousNode()` - returns previous node's output (from history)
   - `$previousNode(index)` - returns node that executed N steps before current
   - `$executionCount(nodeName)` - count of executions for a node
   - `$nodeExecution(nodeName, index)` - specific execution by index (0 = first, -1 = last)
   - `$nodeExecutions(nodeName)` - array of all executions for a node
3. Update `evaluateJsonLogic()` to work with flat context and new functions
4. Functions need access to:
   - Execution history array
   - Current execution index (to determine "previous")

### Phase 4: Update Hooks and Telemetry

1. Update hooks to derive input from history when needed
2. Verify telemetry still works correctly (it already uses history structure, but verify after removing `input` field)
3. Update introspection/debugging docs

### Phase 5: Add Debugging API Endpoint

1. Add `getContextForExecution(executionIndex: number)` method to API:
   - Takes an `executionIndex` to identify a specific execution
   - Builds context from history up to that execution index
   - Returns the context that was available to that node when it executed
   - Useful for time-travel debugging - "what context did this node see?"
2. Add helper method `getExecutionByIndex(executionIndex: number)` to easily access a specific record

### Phase 6: Testing & Documentation

1. Add tests for loop scenarios
2. Add tests for `$previousNode()` and other custom functions
3. Add tests for `getContextForExecution()` API endpoint
4. Update examples to show new capabilities
5. Update documentation

## Open Questions

1. **Performance**: Is building context from history too slow? (Answer: No - we build it once per node execution when the node starts, and it's a simple loop through the history array)

2. **Backward Compatibility**: Do we need to support old flat context structure? (Answer: Yes - the flat context structure maintains full backward compatibility - `$.node_name` works exactly as before)

3. **History Persistence**: Should history be persisted across executions? (Answer: Not in scope for this redesign, but structure supports it)

4. **Parallel Execution**: If we add parallel execution later, how does this design handle it? (Answer: Would need execution IDs or iteration numbers, but structure can accommodate)

## Next Steps

1. **Implementation**: Phase 1 (refactor ExecutionContext)
   - Remove `data` object
   - Remove `input` from `NodeExecutionRecord`
   - Add `executionIndex` to `NodeExecutionRecord`
   - Implement `buildContextFromHistory(upToIndex?)` method
2. **Implementation**: Phase 2 (update node executors)
   - Remove `previousNodeId` parameter from all node executors
   - Update `addHistory()` to include `executionIndex` (current history length)
   - Update exit node to get previous node from history instead of `previousNodeId`
3. **Implementation**: Phase 3 (add history functions)
   - Design function signatures (how to pass history/index to functions)
   - Implement `$previousNode()`, `$executionCount()`, `$nodeExecution()`, `$nodeExecutions()`
4. **Implementation**: Phase 5 (add debugging API)
   - Add `getContextForExecution(executionIndex: number)` to API
   - Add `getExecutionByIndex(executionIndex: number)` helper
5. **Testing**: Ensure all existing tests pass
6. **Testing**: Add loop tests, new function tests, and API endpoint tests

