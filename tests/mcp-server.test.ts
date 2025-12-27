/**
 * Integration tests using MCP client to call the MCP server
 * Tests both count_files and switch examples via MCP protocol
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

function createClient(configPath: string): { client: Client; transport: StdioClientTransport } {
  const transport = new StdioClientTransport({
    command: "tsx",
    args: [join(projectRoot, "src", "main.ts"), "-g", configPath],
  });

  const client = new Client(
    {
      name: "mcpgraph-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  return { client, transport };
}

describe("MCP server integration", () => {
  describe("server metadata", () => {
    it("should return title in server info when provided", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const clientData = createClient(configPath);
      const { client, transport } = clientData;
      
      await client.connect(transport);
      
      // Client.getServerVersion() returns the server Implementation which includes title
      const serverVersion = client.getServerVersion();
      assert(serverVersion !== undefined, "Server version should be present");
      assert.equal(serverVersion.name, "fileUtils", "Should have correct name");
      assert.equal(serverVersion.version, "1.0.0", "Should have correct version");
      assert.equal(serverVersion.title, "File utilities", "Should have correct title");
      
      await client.close();
    });

    it("should default title to name when title not provided", async () => {
      const configPath = join(projectRoot, "examples", "test_minimal.yaml");
      const clientData = createClient(configPath);
      const { client, transport } = clientData;
      
      await client.connect(transport);
      
      const serverVersion = client.getServerVersion();
      assert(serverVersion !== undefined, "Server version should be present");
      assert.equal(serverVersion.name, "testMinimal", "Should have correct name");
      assert.equal(serverVersion.version, "1.0.0", "Should have correct version");
      assert.equal(serverVersion.title, "testMinimal", "Title should default to name when not provided");
      
      await client.close();
    });

    it("should return instructions in initialization response when provided", async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const clientData = createClient(configPath);
      const { client, transport } = clientData;
      
      await client.connect(transport);
      
      // Client.getInstructions() returns the instructions sent by the server during initialization
      const instructions = client.getInstructions();
      
      assert(instructions !== undefined, "Instructions should be present");
      assert.equal(
        instructions,
        "This server provides file utility tools for counting files in directories.",
        "Instructions should match the configured value"
      );
      
      await client.close();
    });

    it("should return undefined for instructions when not provided", async () => {
      const configPath = join(projectRoot, "examples", "test_minimal.yaml");
      const clientData = createClient(configPath);
      const { client, transport } = clientData;
      
      await client.connect(transport);
      
      // Client.getInstructions() should return undefined when server doesn't provide instructions
      const instructions = client.getInstructions();
      assert(instructions === undefined, "Instructions should be undefined when not provided");
      
      await client.close();
    });
  });

  describe("count_files example", () => {
    let client: Client;
    let transport: StdioClientTransport;

    before(async () => {
      const configPath = join(projectRoot, "examples", "count_files.yaml");
      const clientData = createClient(configPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
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

  describe("switch example", () => {
    let client: Client;
    let transport: StdioClientTransport;

    before(async () => {
      const configPath = join(projectRoot, "examples", "switch_example.yaml");
      const clientData = createClient(configPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
    });

    it("should list available tools", async () => {
      const result = await client.listTools();
      
      assert(result !== undefined, "Result should be defined");
      assert(result.tools !== undefined, "Result should have tools");
      assert(Array.isArray(result.tools), "Tools should be an array");
      assert(result.tools.length > 0, "Should have at least one tool");
      
      const switchTool = result.tools.find((t) => t.name === "test_switch");
      assert(switchTool !== undefined, "Should have test_switch tool");
      assert(switchTool.description !== undefined, "Tool should have description");
    });

    it("should route to high_path when value is greater than 10", async () => {
      const result = await client.callTool({
        name: "test_switch",
        arguments: {
          value: 15,
        },
      });

      assert(result !== undefined, "Result should be defined");
      assert(!result.isError, "Result should not be an error");
      assert(result.content !== undefined, "Result should have content");
      assert(Array.isArray(result.content), "Content should be an array");
      
      const textContent = result.content.find((c) => c.type === "text");
      assert(textContent !== undefined, "Should have text content");
      const parsed = JSON.parse((textContent as { text: string }).text);
      assert(parsed.result === "high", `Expected "high", got "${parsed.result}"`);
      
      // Verify structuredContent
      assert(result.structuredContent !== undefined, "Result should have structuredContent");
      const structuredContent = result.structuredContent as Record<string, unknown>;
      assert(structuredContent.result === "high", "structuredContent should match");
    });

    it("should route to low_path when value is between 1 and 10", async () => {
      const result = await client.callTool({
        name: "test_switch",
        arguments: {
          value: 5,
        },
      });

      assert(result !== undefined, "Result should be defined");
      assert(!result.isError, "Result should not be an error");
      assert(result.content !== undefined, "Result should have content");
      assert(Array.isArray(result.content), "Content should be an array");
      
      const textContent = result.content.find((c) => c.type === "text");
      assert(textContent !== undefined, "Should have text content");
      const parsed = JSON.parse((textContent as { text: string }).text);
      assert(parsed.result === "low", `Expected "low", got "${parsed.result}"`);
    });

    it("should route to zero_path (default) when value is zero", async () => {
      const result = await client.callTool({
        name: "test_switch",
        arguments: {
          value: 0,
        },
      });

      assert(result !== undefined, "Result should be defined");
      assert(!result.isError, "Result should not be an error");
      assert(result.content !== undefined, "Result should have content");
      assert(Array.isArray(result.content), "Content should be an array");
      
      const textContent = result.content.find((c) => c.type === "text");
      assert(textContent !== undefined, "Should have text content");
      const parsed = JSON.parse((textContent as { text: string }).text);
      assert(parsed.result === "zero_or_negative", `Expected "zero_or_negative", got "${parsed.result}"`);
    });

    it("should route to zero_path (default) when value is negative", async () => {
      const result = await client.callTool({
        name: "test_switch",
        arguments: {
          value: -5,
        },
      });

      assert(result !== undefined, "Result should be defined");
      assert(!result.isError, "Result should not be an error");
      assert(result.content !== undefined, "Result should have content");
      assert(Array.isArray(result.content), "Content should be an array");
      
      const textContent = result.content.find((c) => c.type === "text");
      assert(textContent !== undefined, "Should have text content");
      const parsed = JSON.parse((textContent as { text: string }).text);
      assert(parsed.result === "zero_or_negative", `Expected "zero_or_negative", got "${parsed.result}"`);
    });
  });
});

