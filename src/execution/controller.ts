/**
 * Execution controller for debugging and introspection
 */

import type {
  ExecutionState,
  ExecutionStatus,
  ExecutionController as IExecutionController,
} from "../types/execution.js";
import type { ExecutionContext } from "./context.js";

export class ExecutionController implements IExecutionController {
  private status: ExecutionStatus = "not_started";
  private currentNodeId: string | null = null;
  private context: ExecutionContext | null = null;
  private breakpoints: Set<string> = new Set();
  private pauseRequested: boolean = false;
  private stepRequested: boolean = false;
  private resumePromise: Promise<void> | null = null;
  private resumeResolve: (() => void) | null = null;

  setContext(context: ExecutionContext): void {
    this.context = context;
  }

  setStatus(status: ExecutionStatus): void {
    this.status = status;
  }

  setCurrentNode(nodeId: string | null): void {
    this.currentNodeId = nodeId;
  }

  async waitIfPaused(): Promise<void> {
    if (this.status === "paused" || this.pauseRequested) {
      this.status = "paused";
      this.pauseRequested = false;
      
      // Create promise for resume
      this.resumePromise = new Promise((resolve) => {
        this.resumeResolve = resolve;
      });
      
      await this.resumePromise;
      this.resumePromise = null;
      this.resumeResolve = null;
    }
  }

  shouldPause(nodeId: string): boolean {
    return this.breakpoints.has(nodeId) || this.pauseRequested;
  }

  pause(): void {
    if (this.status === "running") {
      this.pauseRequested = true;
    } else {
      throw new Error(`Cannot pause: execution status is "${this.status}"`);
    }
  }

  resume(): void {
    if (this.status === "paused") {
      this.status = "running";
      if (this.resumeResolve) {
        this.resumeResolve();
      }
    } else {
      throw new Error(`Cannot resume: execution status is "${this.status}"`);
    }
  }

  async step(): Promise<void> {
    if (this.status === "paused") {
      this.stepRequested = true;
      this.resume();
      // Wait for step to complete (will be paused again after one node)
      await this.waitIfPaused();
    } else {
      throw new Error(`Cannot step: execution status is "${this.status}"`);
    }
  }

  getState(): ExecutionState {
    if (!this.context) {
      throw new Error("Execution context not set");
    }

    return {
      status: this.status,
      currentNodeId: this.currentNodeId,
      executionHistory: this.context.getHistory(),
      context: this.context,
    };
  }

  setBreakpoints(nodeIds: string[]): void {
    this.breakpoints = new Set(nodeIds);
  }

  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  getBreakpoints(): string[] {
    return Array.from(this.breakpoints);
  }

  markStepComplete(): void {
    if (this.stepRequested) {
      this.stepRequested = false;
      this.pauseRequested = true;
    }
  }
}

