/**
 * Integration test for file operations
 */

import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { loadConfig } from "../src/config/loader.js";
import { validateGraph } from "../src/graph/validator.js";
import { GraphExecutor } from "../src/execution/executor.js";
import { McpClientManager } from "../src/mcp/client-manager.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("file operations", () => {
  let executor: GraphExecutor;
  let clientManager: McpClientManager;

  before(async () => {
    const configPath = join(projectRoot, "examples", "count_files.yaml");
    const config = loadConfig(configPath);

    const errors = validateGraph(config);
    if (errors.length > 0) {
      throw new Error(`Graph validation failed: ${errors.map((e) => e.message).join(", ")}`);
    }

    clientManager = new McpClientManager();
    executor = new GraphExecutor(config, clientManager);
  });

  after(async () => {
    await clientManager.closeAll();
  });

  it("should count files in the test directory", async () => {
    const testDir = join(projectRoot, "tests", "files");
    const result = await executor.executeTool("count_files", {
      directory: testDir,
    });

    console.log(`File count result:`, JSON.stringify(result, null, 2));
    
    assert(result !== undefined, "Result should be defined");
    assert(typeof result === "object", "Result should be an object");
    assert("count" in (result as object), "Result should have count property");
    assert(typeof (result as { count: number }).count === "number", "Count should be a number");
    assert((result as { count: number }).count > 0, "Count should be greater than 0");
  });
});

