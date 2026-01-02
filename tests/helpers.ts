/**
 * Test helper functions for common test patterns
 */

import { strict as assert } from "node:assert";

/**
 * Parse and validate an MCP toolkit tool response.
 * 
 * Validates that both structuredContent and content are present and match.
 * Returns the parsed result for further assertions.
 * 
 * @param result - The MCP tool call result
 * @param toolName - Optional tool name for better error messages
 * @returns Object containing parsed result, structuredContent, and textContent
 */
export function parseToolkitResponse(
  result: {
    isError?: boolean;
    content?: unknown[];
    structuredContent?: unknown;
    [key: string]: unknown;
  },
  toolName?: string
): {
  parsed: Record<string, unknown>;
  structuredContent?: unknown;
  textContent: string;
} {
  const toolContext = toolName ? ` (tool: ${toolName})` : "";
  
  // 1. Validate basic structure
  assert(result !== undefined, `Result should be defined${toolContext}`);
  assert(!result.isError, `Result should not be an error${toolContext}`);
  
  // 2. Validate structuredContent if present
  let structuredContent: unknown | undefined;
  if ('structuredContent' in result && result.structuredContent !== undefined) {
    structuredContent = result.structuredContent;
    assert(
      typeof structuredContent === 'object' && structuredContent !== null,
      `structuredContent should be an object${toolContext}`
    );
  }
  
  // 3. Validate and parse content array
  assert(result.content !== undefined, `Result should have content${toolContext}`);
  assert(Array.isArray(result.content), `Content should be an array${toolContext}`);
  
  const textContentItem = result.content.find((c) => 
    typeof c === 'object' && c !== null && 'type' in c && c.type === "text"
  );
  assert(textContentItem !== undefined, `Should have text content${toolContext}`);
  assert(
    'text' in textContentItem && typeof (textContentItem as { text?: unknown }).text === 'string',
    `Text content should have text property${toolContext}`
  );
  
  const textContent = (textContentItem as { text: string }).text;
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(textContent);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from text content${toolContext}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  
  assert(
    typeof parsed === 'object' && parsed !== null,
    `Parsed text content should be an object${toolContext}`
  );
  
  // 4. If both exist, verify they match
  if (structuredContent !== undefined) {
    assert.deepEqual(
      parsed,
      structuredContent,
      `structuredContent and parsed text content should match${toolContext}`
    );
  }
  
  return {
    parsed: parsed as Record<string, unknown>,
    structuredContent,
    textContent,
  };
}
