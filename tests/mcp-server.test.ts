/**
 * Integration test using MCP client to call the MCP server
 */

import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("MCP server integration", () => {
  let client: Client;
  let transport: StdioClientTransport;

  before(async () => {
    // Build the project first
    const configPath = join(projectRoot, "examples", "count_files.yaml");
    
    // Create MCP client that connects to our server
    transport = new StdioClientTransport({
      command: "tsx",
      args: [join(projectRoot, "src", "main.ts"), "-c", configPath],
    });

    client = new Client(
      {
        name: "mcpgraph-test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // connect() automatically calls start() on the transport
    await client.connect(transport);
  });

  after(async () => {
    await client.close();
    // Transport cleanup will happen automatically
  });

  it("should list available tools", async () => {
    const result = await client.listTools();
    
    assert(result !== undefined, "Result should be defined");
    assert(result.tools !== undefined, "Result should have tools");
    assert(Array.isArray(result.tools), "Tools should be an array");
    assert(result.tools.length > 0, "Should have at least one tool");
    
    const countFilesTool = result.tools.find((t) => t.name === "count_files");
    assert(countFilesTool !== undefined, "Should have count_files tool");
    assert(countFilesTool.description !== undefined, "Tool should have description");
  });

  it("should count files in the test directory via MCP client", async () => {
    const testDir = join(projectRoot, "tests", "files");
    
    const result = await client.callTool({
      name: "count_files",
      arguments: {
        directory: testDir,
      },
    });

    assert(result !== undefined, "Result should be defined");
    assert(!result.isError, "Result should not be an error");
    assert(result.content !== undefined, "Result should have content");
    assert(Array.isArray(result.content), "Content should be an array");
    assert(result.content.length > 0, "Content should have at least one item");
    
    const textContent = result.content.find((c) => c.type === "text");
    assert(textContent !== undefined, "Should have text content");
    assert("text" in textContent, "Text content should have text property");
    
    const parsed = JSON.parse(textContent.text as string);
    assert(parsed !== undefined, "Parsed result should be defined");
    assert(typeof parsed === "object", "Parsed result should be an object");
    assert("count" in parsed, "Result should have count property");
    assert(typeof parsed.count === "number", "Count should be a number");
    assert(parsed.count > 0, "Count should be greater than 0");
    
    // Verify structuredContent is present and matches the parsed content
    assert(result.structuredContent !== undefined, "Result should have structuredContent");
    assert(result.structuredContent !== null, "structuredContent should not be null");
    assert(typeof result.structuredContent === "object", "structuredContent should be an object");
    const structuredContent = result.structuredContent as Record<string, unknown>;
    assert("count" in structuredContent, "structuredContent should have count property");
    assert(typeof structuredContent.count === "number", "structuredContent count should be a number");
    assert(structuredContent.count === parsed.count, "structuredContent count should match parsed count");
  });
});

