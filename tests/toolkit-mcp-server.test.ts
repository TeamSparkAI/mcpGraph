/**
 * MCP client integration tests for mcpGraphToolkit server
 * Tests all 11 toolkit tools via MCP protocol
 */

import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { dump } from "js-yaml";
import { parseToolkitResponse } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

function createToolkitClient(
  graphPath: string,
  mcpPath?: string
): { client: Client; transport: StdioClientTransport } {
  const args = ["-g", graphPath];
  if (mcpPath) {
    args.push("-m", mcpPath);
  }

  const transport = new StdioClientTransport({
    command: "tsx",
    args: [join(projectRoot, "src", "toolkit-main.ts"), ...args],
  });

  const client = new Client(
    {
      name: "mcpgraphtoolkit-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  return { client, transport };
}

describe("mcpGraphToolkit MCP server integration", () => {
  describe("server metadata", () => {
    it("should return correct server info", async () => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      const clientData = createToolkitClient(configPath);
      const { client, transport } = clientData;

      try {
        await client.connect(transport);

        const serverVersion = client.getServerVersion();
        assert(serverVersion !== undefined, "Server version should be present");
        assert.equal(serverVersion.name, "mcpgraphtoolkit", "Should have correct name");
        assert.equal(serverVersion.version, "1.0.0", "Should have correct version");
        assert.equal(serverVersion.title, "mcpGraph Toolkit", "Should have correct title");

        const instructions = client.getInstructions();
        assert(instructions !== undefined, "Instructions should be present");
        assert.equal(
          instructions,
          "Tools for building, testing, and running mcpGraph tools. IMPORTANT: Before creating graph tools, read the mcpgraphtoolkit SKILL.md (if available) for required structure and examples.",
          "Instructions should match"
        );
      } finally {
        await client.close();
      }
    });
  });

  describe("tool listing", () => {
    let client: Client;
    let transport: StdioClientTransport;

    before(async () => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      const clientData = createToolkitClient(configPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
    });

    it("should list all toolkit tools", async () => {
      try {
        const result = await client.listTools();

        assert(result !== undefined, "Result should be defined");
        assert(result.tools !== undefined, "Result should have tools");
        assert(Array.isArray(result.tools), "Tools should be an array");
        assert(result.tools.length >= 11, "Should have at least 11 tools");

      const toolNames = result.tools.map((t) => t.name);
      assert(toolNames.includes("getGraphServer"), "Should include getGraphServer");
      assert(toolNames.includes("listGraphTools"), "Should include listGraphTools");
      assert(toolNames.includes("getGraphTool"), "Should include getGraphTool");
      assert(toolNames.includes("listMcpServers"), "Should include listMcpServers");
      assert(toolNames.includes("listMcpServerTools"), "Should include listMcpServerTools");
      assert(toolNames.includes("getMcpServerTool"), "Should include getMcpServerTool");
      assert(toolNames.includes("addGraphTool"), "Should include addGraphTool");
      assert(toolNames.includes("updateGraphTool"), "Should include updateGraphTool");
      assert(toolNames.includes("deleteGraphTool"), "Should include deleteGraphTool");
      assert(toolNames.includes("runGraphTool"), "Should include runGraphTool");
      assert(toolNames.includes("testJSONata"), "Should include testJSONata");
      assert(toolNames.includes("testJSONLogic"), "Should include testJSONLogic");
      assert(toolNames.includes("testMcpTool"), "Should include testMcpTool");
      } catch (error: unknown) {
        console.error("Error in listTools:", error);
        if (error && typeof error === 'object' && 'issues' in error) {
          console.error("ZodError issues:", JSON.stringify((error as { issues: unknown }).issues, null, 2));
        }
        throw error;
      }
    });
  });

  describe("graph introspection tools", () => {
    let client: Client;
    let transport: StdioClientTransport;

    before(async () => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      const clientData = createToolkitClient(configPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
    });

    it("should get graph server info", async () => {
      const result = await client.callTool({
        name: "getGraphServer",
        arguments: {},
      });

      const { parsed } = parseToolkitResponse(result, "getGraphServer");
      
      assert.equal(parsed.name, "fileUtils", "Should have correct name");
      assert.equal(parsed.version, "1.0.0", "Should have correct version");
      assert.equal(parsed.title, "File utilities", "Should have correct title");
    });

    it("should list graph tools", async () => {
      const result = await client.callTool({
        name: "listGraphTools",
        arguments: {},
      });

      const { parsed } = parseToolkitResponse(result, "listGraphTools");
      
      assert(typeof parsed === "object", "Should return object");
      assert(Array.isArray(parsed.items), "Should have items array");
      assert(parsed.items.length > 0, "Should have tools");
      
      const countFilesTool = parsed.items.find((t: { name?: string }) => t.name === "count_files");
      assert(countFilesTool !== undefined, "Should include count_files");
      assert(countFilesTool.description !== undefined, "Should have description");
    });

    it("should get graph tool details", async () => {
      const result = await client.callTool({
        name: "getGraphTool",
        arguments: {
          toolName: "count_files",
        },
      });

      const { parsed } = parseToolkitResponse(result, "getGraphTool");
      
      assert.equal(parsed.name, "count_files", "Should have correct name");
      assert(parsed.nodes !== undefined, "Should have nodes");
      assert(Array.isArray(parsed.nodes), "Nodes should be an array");
    });

    it("should return error for non-existent graph tool", async () => {
      try {
        const result = await client.callTool({
          name: "getGraphTool",
          arguments: {
            toolName: "nonexistent",
          },
        });
        // If no exception, check if result has isError
        if (result.isError) {
          assert(result.isError, "Result should be an error");
        } else {
          assert.fail("Expected error but got success result");
        }
      } catch (error: unknown) {
        // MCP SDK throws exceptions for errors
        assert(error !== undefined, "Error should be thrown");
        const mcpError = error as { code?: number; message?: string };
        assert(mcpError.code !== undefined, "Error should have code");
        assert(mcpError.message !== undefined, "Error should have message");
        assert(mcpError.message.includes("not found"), "Error message should mention not found");
      }
    });
  });

  describe("MCP server discovery tools", () => {
    let client: Client;
    let transport: StdioClientTransport;
    let tempMcpPath: string;

    before(async () => {
      // Create a temporary MCP JSON file
      const mcpConfig = {
        mcpServers: {
          testServer: {
            command: "echo",
            args: ["test"],
          },
        },
      };
      tempMcpPath = join(projectRoot, "tests", "files", "temp-toolkit-mcp.json");
      writeFileSync(tempMcpPath, JSON.stringify(mcpConfig, null, 2));

      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      const clientData = createToolkitClient(configPath, tempMcpPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
      try {
        unlinkSync(tempMcpPath);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should list MCP servers", async () => {
      const result = await client.callTool({
        name: "listMcpServers",
        arguments: {},
      });

      const { parsed } = parseToolkitResponse(result, "listMcpServers");
      
      assert(typeof parsed === "object", "Should return object");
      assert(Array.isArray(parsed.items), "Should have items array");
      assert(parsed.items.length > 0, "Should have servers");
      
      const testServer = parsed.items.find((s: { name?: string }) => s.name === "testServer");
      assert(testServer !== undefined, "Should include testServer");
    });

    it("should return error when MCP file not provided", async () => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      const clientData = createToolkitClient(configPath); // No -m flag
      const testClient = clientData.client;
      const testTransport = clientData.transport;

      await testClient.connect(testTransport);

      try {
        const result = await testClient.callTool({
          name: "listMcpServers",
          arguments: {},
        });

        // If no exception, check if result has isError
        if (result.isError) {
          assert(result.isError, "Result should be an error");
        } else {
          assert.fail("Expected error but got success result");
        }
      } catch (error: unknown) {
        // MCP SDK throws exceptions for errors
        assert(error !== undefined, "Error should be thrown");
        const mcpError = error as { code?: number; message?: string };
        assert(mcpError.code !== undefined, "Error should have code");
        assert(mcpError.message !== undefined, "Error should have message");
        assert(mcpError.message.includes("MCP file not provided"), "Error message should mention MCP file");
      } finally {
        await testClient.close();
      }
    });
  });

  describe("graph manipulation tools", () => {
    let client: Client;
    let transport: StdioClientTransport;
    let tempConfigPath: string;

    before(async () => {
      // Create a temporary config file for testing
      const testConfig = {
        version: "1.0",
        server: { name: "test", version: "1.0.0", title: "Test" },
        tools: [
          {
            name: "existing_tool",
            description: "Existing tool",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            nodes: [
              { id: "entry", type: "entry", next: "exit" },
              { id: "exit", type: "exit" },
            ],
          },
        ],
      };
      tempConfigPath = join(projectRoot, "tests", "files", "temp-toolkit-manipulation.yaml");
      writeFileSync(tempConfigPath, dump(testConfig));

      const clientData = createToolkitClient(tempConfigPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
      try {
        unlinkSync(tempConfigPath);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should add a new tool to the graph", async () => {
      const newTool = {
        name: "new_tool",
        description: "New tool",
        inputSchema: { type: "object", properties: { value: { type: "string" } } },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };

      const result = await client.callTool({
        name: "addGraphTool",
        arguments: {
          tool: newTool,
        },
      });

      const { parsed } = parseToolkitResponse(result, "addGraphTool");
      
      assert.equal(parsed.success, true, "Should indicate success");
      
      // Verify tool was added by reading the file
      const savedContent = readFileSync(tempConfigPath, "utf-8");
      assert(savedContent.includes("new_tool"), "Tool should be saved to file");
    });

    it("should update an existing tool", async () => {
      const updatedTool = {
        name: "existing_tool",
        description: "Updated description",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };

      const result = await client.callTool({
        name: "updateGraphTool",
        arguments: {
          toolName: "existing_tool",
          tool: updatedTool,
        },
      });

      assert(result !== undefined, "Result should be defined");
      assert(!result.isError, "Result should not be an error");
      
      // Verify by getting the tool
      const getResult = await client.callTool({
        name: "getGraphTool",
        arguments: {
          toolName: "existing_tool",
        },
      });

      assert(!getResult.isError, "Should be able to get tool");
      const { parsed } = parseToolkitResponse(getResult, "getGraphTool");
      assert.equal(parsed.description, "Updated description", "Tool should be updated");
    });

    it("should delete a tool from the graph", async () => {
      // First, make sure the tool exists by adding it if needed
      // (in case previous tests modified the graph)
      const ensureTool = {
        name: "existing_tool",
        description: "Existing tool",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };
      
      // Try to update first (will add if doesn't exist due to how updateTool works)
      try {
        await client.callTool({
          name: "updateGraphTool",
          arguments: {
            toolName: "existing_tool",
            tool: ensureTool,
          },
        });
      } catch {
        // If update fails, try adding
        await client.callTool({
          name: "addGraphTool",
          arguments: {
            tool: ensureTool,
          },
        });
      }

      // Now delete it
      const result = await client.callTool({
        name: "deleteGraphTool",
        arguments: {
          toolName: "existing_tool",
        },
      });

      assert(result !== undefined, "Result should be defined");
      assert(!result.isError, "Result should not be an error");
      
      // Verify tool was deleted
      try {
        const getResult = await client.callTool({
          name: "getGraphTool",
          arguments: {
            toolName: "existing_tool",
          },
        });
        // If no exception, check if result has isError
        if (getResult.isError) {
          assert(getResult.isError, "Should return error for deleted tool");
        } else {
          assert.fail("Expected error for deleted tool");
        }
      } catch (error: unknown) {
        // MCP SDK throws exceptions for errors - this is expected
        assert(error !== undefined, "Error should be thrown for deleted tool");
        const mcpError = error as { code?: number; message?: string };
        assert(mcpError.message !== undefined, "Error should have message");
        assert(mcpError.message.includes("not found"), "Error message should mention not found");
      }
    });
  });

  describe("runGraphTool", () => {
    let client: Client;
    let transport: StdioClientTransport;

    before(async () => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      const clientData = createToolkitClient(configPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
    });

    it("should run a tool by name", async () => {
      const result = await client.callTool({
        name: "runGraphTool",
        arguments: {
          toolName: "count_files",
          arguments: {
            directory: join(projectRoot, "tests", "counting"),
          },
        },
      });

      const { parsed } = parseToolkitResponse(result, "runGraphTool");
      
      assert(parsed.result !== undefined, "Should have result");
      const resultObj = parsed.result as { count?: number };
      assert(resultObj.count !== undefined, "Should have count property");
      assert(typeof resultObj.count === "number", "Count should be a number");
    });

    it("should run a tool definition inline", async () => {
      const toolDefinition = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "string" },
          },
        },
        outputSchema: { type: "object" },
        nodes: [
          {
            id: "entry",
            type: "entry",
            next: "transform",
          },
          {
            id: "transform",
            type: "transform",
            transform: {
              expr: '{"result": $.entry.value}',
            },
            next: "exit",
          },
          {
            id: "exit",
            type: "exit",
          },
        ],
      };

      const result = await client.callTool({
        name: "runGraphTool",
        arguments: {
          toolDefinition: toolDefinition,
          arguments: {
            value: "test_value",
          },
        },
      });

      const { parsed } = parseToolkitResponse(result, "runGraphTool");
      
      assert(parsed.result !== undefined, "Should have result");
      const resultObj = parsed.result as { result?: string };
      assert.equal(resultObj.result, "test_value", "Should execute correctly");
    });

    it("should collect logs when logging is enabled", async () => {
      const toolDefinition = {
        name: "test_tool_logging",
        description: "Test tool with logging",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        nodes: [
          { id: "entry", type: "entry", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      };

      const result = await client.callTool({
        name: "runGraphTool",
        arguments: {
          toolDefinition: toolDefinition,
          arguments: {},
          logging: true,
        },
      });

      const { parsed } = parseToolkitResponse(result, "runGraphTool");
      
      assert(parsed.logging !== undefined, "Should have logging");
      assert(Array.isArray(parsed.logging), "Logging should be an array");
      assert(parsed.logging.length > 0, "Should have log entries");
    });
  });

  describe("expression testing tools", () => {
    let client: Client;
    let transport: StdioClientTransport;

    before(async () => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      const clientData = createToolkitClient(configPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
    });

    it("should test valid JSONata expression", async () => {
      const result = await client.callTool({
        name: "testJSONata",
        arguments: {
          expression: '{"result": $.value * 2}',
          context: { value: 5 },
        },
      });

      const { parsed } = parseToolkitResponse(result, "testJSONata");
      
      assert(parsed.error === undefined, "Should not have error");
      assert(parsed.result !== undefined, "Should have result");
      const resultObj = parsed.result as { result?: number };
      assert.equal(resultObj.result, 10, "Should evaluate correctly");
    });

    it("should return error for invalid JSONata expression", async () => {
      const result = await client.callTool({
        name: "testJSONata",
        arguments: {
          expression: '{"result": $.value + }',
          context: { value: 5 },
        },
      });

      const { parsed } = parseToolkitResponse(result, "testJSONata");
      
      assert(parsed.error !== undefined, "Should have error");
      assert(parsed.result === null, "Result should be null on error");
    });

    it("should test valid JSON Logic expression", async () => {
      const result = await client.callTool({
        name: "testJSONLogic",
        arguments: {
          expression: { ">": [{ var: "value" }, 10] },
          context: { value: 15 },
        },
      });

      const { parsed } = parseToolkitResponse(result, "testJSONLogic");
      
      assert(parsed.error === undefined, "Should not have error");
      assert.equal(parsed.result, true, "Should evaluate to true");
    });

    it("should test JSON Logic expression that evaluates to false", async () => {
      const result = await client.callTool({
        name: "testJSONLogic",
        arguments: {
          expression: { ">": [{ var: "value" }, 10] },
          context: { value: 5 },
        },
      });

      const { parsed } = parseToolkitResponse(result, "testJSONLogic");
      
      assert(parsed.error === undefined, "Should not have error");
      assert.equal(parsed.result, false, "Should evaluate to false");
    });

    it("should test MCP tool call directly", async () => {
      const testDir = join(projectRoot, "tests", "counting");
      const result = await client.callTool({
        name: "testMcpTool",
        arguments: {
          server: "filesystem",
          tool: "list_directory",
          args: {
            path: testDir,
          },
        },
      });

      const { parsed } = parseToolkitResponse(result, "testMcpTool");
      
      assert(parsed.error === undefined, "Should not have error");
      assert(parsed.output !== undefined, "Should have output");
      assert(parsed.executionTime !== undefined, "Should have executionTime");
      assert(typeof parsed.executionTime === "number", "executionTime should be a number");
      assert(parsed.executionTime >= 0, "executionTime should be non-negative");
      
      // Validate list_directory output: filesystem MCP server returns an object with "content" property
      // Format: {"content": "[FILE] filename.ext\n[FILE] filename2.ext\n"}
      assert(typeof parsed.output === "object" && parsed.output !== null, "Output should be an object");
      const outputObj = parsed.output as { content?: string };
      assert(typeof outputObj.content === "string", "Output should have content property that is a string");
      const output = outputObj.content;
      assert(output.length > 0, "Output content should not be empty");
      
      // Split by newlines to get file entries
      const lines = output.split("\n").filter(line => line.trim().length > 0);
      assert(lines.length > 0, "Should have at least one file entry");
      
      // Each line should be in format "[FILE] filename.ext"
      lines.forEach((line, index) => {
        assert(line.startsWith("[FILE]"), `Line ${index} should start with "[FILE]": ${line}`);
        assert(line.length > 7, `Line ${index} should contain filename after "[FILE] "`);
      });
      
      // Verify we can find expected files in the test directory
      assert(output.includes("test1.txt") || output.includes("test2.md") || output.includes("test3.json") || 
             output.includes("test4.py") || output.includes("README.md") || output.includes("data.csv"),
             `Output should contain at least one known test file. Output: ${output.substring(0, 300)}`);
    });

    it("should test MCP tool call with JSONata expressions in args", async () => {
      const testDir = join(projectRoot, "tests", "counting");
      const result = await client.callTool({
        name: "testMcpTool",
        arguments: {
          server: "filesystem",
          tool: "list_directory",
          args: {
            path: { expr: "$.entry.directory" },
          },
          context: {
            entry: {
              directory: testDir,
            },
          },
        },
      });

      const { parsed } = parseToolkitResponse(result, "testMcpTool");
      
      assert(parsed.error === undefined, "Should not have error");
      assert(parsed.output !== undefined, "Should have output");
      assert(parsed.executionTime !== undefined, "Should have executionTime");
      assert(parsed.evaluatedArgs !== undefined, "Should have evaluatedArgs when JSONata is used");
      const evaluatedArgs = parsed.evaluatedArgs as { path?: string };
      assert.equal(evaluatedArgs.path, testDir, "Evaluated args should have correct path");
      
      // Validate list_directory output format (same as above)
      assert(typeof parsed.output === "object" && parsed.output !== null, "Output should be an object");
      const outputObj = parsed.output as { content?: string };
      assert(typeof outputObj.content === "string", "Output should have content property that is a string");
      const output = outputObj.content;
      assert(output.length > 0, "Output content should not be empty");
      
      const lines = output.split("\n").filter(line => line.trim().length > 0);
      assert(lines.length > 0, "Should have at least one file entry");
      
      lines.forEach((line, index) => {
        assert(line.startsWith("[FILE]"), `Line ${index} should start with "[FILE]": ${line}`);
      });
      
      assert(output.includes("test1.txt") || output.includes("test2.md") || output.includes("test3.json") || 
             output.includes("test4.py"), `Output should contain at least one known test file. Output: ${output.substring(0, 300)}`);
    });

    it("should return error for server not found", async () => {
      const result = await client.callTool({
        name: "testMcpTool",
        arguments: {
          server: "nonexistent_server",
          tool: "list_directory",
          args: {
            path: "/tmp",
          },
        },
      });

      const { parsed } = parseToolkitResponse(result, "testMcpTool");
      
      assert(parsed.error !== undefined, "Should have error");
      const error = parsed.error as { message?: string };
      assert(error.message !== undefined, "Error should have message");
      assert(error.message.includes("not found"), "Error message should mention not found");
      assert(parsed.output === null, "Output should be null on error");
    });

    it("should return error for invalid JSONata expression in args", async () => {
      const result = await client.callTool({
        name: "testMcpTool",
        arguments: {
          server: "filesystem",
          tool: "list_directory",
          args: {
            path: { expr: "$.entry.directory +" },
          },
          context: {
            entry: {
              directory: "/tmp",
            },
          },
        },
      });

      const { parsed } = parseToolkitResponse(result, "testMcpTool");
      
      assert(parsed.error !== undefined, "Should have error");
      const error = parsed.error as { message?: string };
      assert(error.message !== undefined, "Error should have message");
      assert(error.message.includes("JSONata"), "Error message should mention JSONata");
      assert(parsed.output === null, "Output should be null on error");
    });
  });

  describe("error handling", () => {
    let client: Client;
    let transport: StdioClientTransport;

    before(async () => {
      const configPath = join(projectRoot, "examples", "file_utils.yaml");
      const clientData = createToolkitClient(configPath);
      client = clientData.client;
      transport = clientData.transport;
      await client.connect(transport);
    });

    after(async () => {
      await client.close();
    });

    it("should return error for missing required parameters", async () => {
      try {
        const result = await client.callTool({
          name: "getGraphTool",
          arguments: {},
        });
        // If no exception, check if result has isError
        if (result.isError) {
          assert(result.isError, "Result should be an error");
        } else {
          assert.fail("Expected error but got success result");
        }
      } catch (error: unknown) {
        // MCP SDK throws exceptions for errors
        assert(error !== undefined, "Error should be thrown");
        const mcpError = error as { code?: number; message?: string };
        assert(mcpError.code !== undefined, "Error should have code");
        assert(mcpError.message !== undefined, "Error should have message");
        assert(mcpError.message.includes("toolName is required"), "Error message should mention toolName");
      }
    });

    it("should return error for invalid tool name", async () => {
      try {
        const result = await client.callTool({
          name: "runGraphTool",
          arguments: {
            toolName: "nonexistent",
            arguments: {},
          },
        });
        // If no exception, check if result has isError
        if (result.isError) {
          assert(result.isError, "Result should be an error");
        } else {
          assert.fail("Expected error but got success result");
        }
      } catch (error: unknown) {
        // MCP SDK throws exceptions for errors
        assert(error !== undefined, "Error should be thrown");
        const mcpError = error as { code?: number; message?: string };
        assert(mcpError.code !== undefined, "Error should have code");
        assert(mcpError.message !== undefined, "Error should have message");
      }
    });

    it("should return error when both toolName and toolDefinition provided", async () => {
      try {
        const result = await client.callTool({
          name: "runGraphTool",
          arguments: {
            toolName: "count_files",
            toolDefinition: {
              name: "test",
              description: "Test",
              inputSchema: { type: "object" },
              outputSchema: { type: "object" },
              nodes: [],
            },
            arguments: {},
          },
        });
        // If no exception, check if result has isError
        if (result.isError) {
          assert(result.isError, "Result should be an error");
        } else {
          assert.fail("Expected error but got success result");
        }
      } catch (error: unknown) {
        // MCP SDK throws exceptions for errors
        assert(error !== undefined, "Error should be thrown");
        const mcpError = error as { code?: number; message?: string };
        assert(mcpError.code !== undefined, "Error should have code");
        assert(mcpError.message !== undefined, "Error should have message");
        assert(mcpError.message.includes("Cannot specify both"), "Error message should mention conflict");
      }
    });
  });
});

