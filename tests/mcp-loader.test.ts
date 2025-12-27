/**
 * Tests for MCP JSON file loading
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { loadMcpServers } from "../src/config/mcp-loader.js";
import { loadConfig } from "../src/config/loader.js";
import { McpGraphApi } from "../src/api.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { StdioServerConfig } from "../src/types/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("MCP file loading", () => {
  describe("loadMcpServers", () => {
    it("should load mcpServers from a valid MCP JSON file", () => {
      const mcpPath = join(projectRoot, "tests", "files", "test-mcp-valid.json");
      const servers = loadMcpServers(mcpPath);
      assert(servers !== undefined, "Should return servers");
      assert.equal(Object.keys(servers).length, 2, "Should load 2 servers");
      assert("testServer" in servers, "Should include testServer");
      assert("httpServer" in servers, "Should include httpServer");
      
      const testServer = servers.testServer as StdioServerConfig;
      assert.equal(testServer.command, "echo", "Should parse stdio server correctly");
      assert.equal(servers.httpServer.type, "streamableHttp", "Should parse HTTP server correctly");
    });

    it("should return undefined if mcpServers is missing", () => {
      const mcpPath = join(projectRoot, "tests", "files", "test-mcp-no-servers.json");
      const servers = loadMcpServers(mcpPath);
      assert.equal(servers, undefined, "Should return undefined when no mcpServers");
    });

    it("should return undefined if mcpServers is empty", () => {
      const mcpPath = join(projectRoot, "tests", "files", "test-mcp-empty.json");
      const servers = loadMcpServers(mcpPath);
      assert.equal(servers, undefined, "Should return undefined when mcpServers is empty");
    });

    it("should throw error if file does not exist", () => {
      const mcpPath = join(projectRoot, "tests", "files", "nonexistent-mcp.json");
      assert.throws(
        () => loadMcpServers(mcpPath),
        /MCP file not found/,
        "Should throw error for missing file"
      );
    });

    it("should throw error for invalid server config", () => {
      const mcpPath = join(projectRoot, "tests", "files", "test-mcp-invalid.json");
      assert.throws(
        () => loadMcpServers(mcpPath),
        (error: Error) => {
          // Error could be from Zod validation (schema level) or our custom error
          return (
            error.message.includes("Failed to load MCP file") ||
            error.message.includes("Invalid") ||
            error.message.includes("required") ||
            error.message.includes("command")
          );
        },
        "Should throw error for invalid server config"
      );
    });
  });

  describe("loadConfig with mcpServers merging", () => {
    it("should merge mcpServers from MCP file and graph (graph overrides)", () => {
      const mcpPath = join(projectRoot, "tests", "files", "test-mcp-merge.json");
      const graphPath = join(projectRoot, "tests", "files", "test-graph-merge.yaml");

      const mcpServers = loadMcpServers(mcpPath);
      const config = loadConfig(graphPath, mcpServers);

      assert(config.mcpServers !== undefined, "Should have mcpServers");
      
      // Should have all three servers
      assert.equal(Object.keys(config.mcpServers).length, 3, "Should have 3 servers");
      
      // sharedServer should come from graph (override)
      assert("sharedServer" in config.mcpServers, "Should have sharedServer");
      const sharedServer = config.mcpServers.sharedServer as StdioServerConfig;
      assert.equal(
        sharedServer.args[0],
        "from-graph",
        "Graph server should override MCP file server"
      );
      
      // mcpOnlyServer should come from MCP file
      assert("mcpOnlyServer" in config.mcpServers, "Should have mcpOnlyServer");
      const mcpOnlyServer = config.mcpServers.mcpOnlyServer as StdioServerConfig;
      assert.equal(
        mcpOnlyServer.args[0],
        "mcp-only",
        "MCP file server should be included"
      );
      
      // graphOnlyServer should come from graph
      assert("graphOnlyServer" in config.mcpServers, "Should have graphOnlyServer");
      const graphOnlyServer = config.mcpServers.graphOnlyServer as StdioServerConfig;
      assert.equal(
        graphOnlyServer.args[0],
        "graph-only",
        "Graph server should be included"
      );
    });
  });

  describe("McpGraphApi with MCP file", () => {
    it("should load graph with mcpServers from MCP file", async () => {
      const mcpPath = join(projectRoot, "tests", "files", "test-mcp-valid.json");
      const graphPath = join(projectRoot, "tests", "files", "test-graph-with-mcp.yaml");

      const mcpServers = loadMcpServers(mcpPath);
      const api = new McpGraphApi(graphPath, mcpServers);
      await api.close();

      const config = api.getConfig();
      assert(config.mcpServers !== undefined, "Should have mcpServers");
      assert("testServer" in config.mcpServers, "Should include server from MCP file");
    });
  });
});

