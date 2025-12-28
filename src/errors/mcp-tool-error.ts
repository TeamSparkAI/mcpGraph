/**
 * Custom error classes for MCP tool execution errors
 */

import { McpError } from "@modelcontextprotocol/sdk/types.js";

/**
 * Error thrown when an MCP protocol-level error occurs during tool execution
 * (e.g., connection failures, transport errors, server crashes)
 * 
 * Extends McpError to preserve MCP error structure (code, message, data)
 * and adds stderr output from the MCP server process
 */
export class ToolCallMcpError extends McpError {
  /**
   * Array of stderr lines captured from the MCP server process
   * This is particularly useful for stdio-based MCP servers that write
   * detailed error information to stderr
   */
  public readonly stderr: string[];

  constructor(
    mcpError: McpError,
    stderr: string[]
  ) {
    // Preserve original MCP error properties
    super(mcpError.code, mcpError.message, mcpError.data);
    this.name = 'ToolCallMcpError';
    this.stderr = stderr;
    
    // Enhance message with stderr for logging/debugging, but keep structured access
    if (stderr.length > 0) {
      this.message += `\n\nServer stderr output:\n${stderr.join('\n')}`;
    }
  }
}

/**
 * Error thrown when an MCP tool call completes successfully at the protocol level,
 * but the tool itself returns an error response (result.isError = true)
 * 
 * This represents a logical failure in the tool execution, not a protocol failure.
 * The full result object is preserved for inspection.
 */
export class ToolCallError extends Error {
  /**
   * The complete result object from the MCP tool call
   * This includes the error response, content, and any other result properties
   */
  public readonly result: {
    isError?: boolean;
    content: unknown[];
    error?: unknown;
    [key: string]: unknown;
  };

  constructor(result: {
    isError?: boolean;
    content: unknown[];
    error?: unknown;
    [key: string]: unknown;
  }) {
    // Extract error message from result content
    const content = result.content as Array<{ text?: string }> | undefined;
    let errorMessage = "Tool call failed";
    
    if (content && content.length > 0) {
      const firstContent = content[0];
      if (firstContent && typeof firstContent === 'object' && 'text' in firstContent) {
        errorMessage = firstContent.text || errorMessage;
      } else if (typeof firstContent === 'string') {
        errorMessage = firstContent;
      }
    }
    
    // Include result in message for logging/debugging
    const resultStr = JSON.stringify(result, null, 2);
    super(`${errorMessage}\n\nTool call result:\n${resultStr}`);
    
    this.name = 'ToolCallError';
    this.result = result;
  }
}

