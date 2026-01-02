/**
 * Utility for extracting output from MCP tool call results
 * 
 * This function implements the exact same logic used by mcp-tool-executor.ts
 * to ensure testMcpTool returns the same output that would be available
 * in a graph node's execution context.
 */

/**
 * Extract the output from an MCP tool call result.
 * This matches the exact extraction logic used in mcp-tool-executor.ts
 * 
 * @param result - The result from client.callTool()
 * @returns The extracted output (structuredContent if present, otherwise parsed/raw content)
 * @throws Error if result is in an unexpected format
 */
export function extractMcpToolOutput(result: {
  isError?: boolean;
  content?: unknown[];
  structuredContent?: unknown;
  [key: string]: unknown;
}): unknown {
  // Check for structuredContent first (if present, use it as output)
  if ('structuredContent' in result && result.structuredContent !== undefined) {
    // Use structuredContent if available (regardless of content presence)
    return result.structuredContent;
  } else if ('content' in result) {
    // Fall back to processing text content
    const content = (result.content ?? []) as Array<{ text?: string } | unknown>;
    
    if (content[0] && typeof content[0] === "object" && "text" in content[0]) {
      const textContent = (content[0] as { text?: string }).text;
      if (textContent) {
        try {
          return JSON.parse(textContent);
        } catch {
          return textContent;
        }
      } else {
        return content[0];
      }
    } else {
      return content[0];
    }
  } else {
    // toolResult variant - not expected in normal flow, but handle it
    throw new Error('Expected content-based result, got toolResult variant');
  }
}
