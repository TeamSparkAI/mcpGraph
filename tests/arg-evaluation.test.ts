import { test } from "node:test";
import { strict as assert } from "node:assert";
import { evaluateArgValue } from "../src/execution/arg-evaluator.js";
import type { NodeExecutionRecord } from "../src/types/execution.js";

test("should evaluate simple expression object", async () => {
  const context = { entry: { path: "/test" } };
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    { expr: "$.entry.path" },
    context,
    history,
    0
  );
  assert.equal(result, "/test");
});

test("should pass through literal strings", async () => {
  const context = {};
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    "literal/path",
    context,
    history,
    0
  );
  assert.equal(result, "literal/path");
});

test("should pass through literal numbers", async () => {
  const context = {};
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    42,
    context,
    history,
    0
  );
  assert.equal(result, 42);
});

test("should pass through literal booleans", async () => {
  const context = {};
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    true,
    context,
    history,
    0
  );
  assert.equal(result, true);
});

test("should pass through null", async () => {
  const context = {};
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    null,
    context,
    history,
    0
  );
  assert.equal(result, null);
});

test("should evaluate nested expression objects", async () => {
  const context = { entry: { filename: "test.txt" } };
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    {
      path: { expr: "'downloads/' & $.entry.filename" },
      options: {
        recursive: true,
        filter: { expr: "$.entry.filename" }
      }
    },
    context,
    history,
    0
  );
  assert.deepEqual(result, {
    path: "downloads/test.txt",
    options: {
      recursive: true,
      filter: "test.txt"
    }
  });
});

test("should error on expression object with other keys", async () => {
  const context = {};
  const history: NodeExecutionRecord[] = [];
  await assert.rejects(
    async () => {
      await evaluateArgValue(
        { expr: "$.entry.path", other: "value" },
        context,
        history,
        0
      );
    },
    /Invalid expression object/
  );
});

test("should recurse into arrays", async () => {
  const context = { entry: { item1: "a", item2: "b" } };
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    [
      { expr: "$.entry.item1" },
      "literal",
      { expr: "$.entry.item2" }
    ],
    context,
    history,
    0
  );
  assert.deepEqual(result, ["a", "literal", "b"]);
});

test("should handle nested arrays with expressions", async () => {
  const context = { entry: { items: ["x", "y", "z"] } };
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    {
      paths: [
        { expr: "$.entry.items[0]" },
        { expr: "$.entry.items[1]" }
      ]
    },
    context,
    history,
    0
  );
  assert.deepEqual(result, {
    paths: ["x", "y"]
  });
});

test("should handle string concatenation expression", async () => {
  const context = { entry: { filename: "test.txt" } };
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    { expr: "'downloads/' & $.entry.filename" },
    context,
    history,
    0
  );
  assert.equal(result, "downloads/test.txt");
});

test("should handle complex nested structure", async () => {
  const context = {
    entry: {
      basePath: "/data",
      filename: "file.txt",
      maxDepth: 5
    }
  };
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    {
      path: { expr: "$.entry.basePath & '/downloads/' & $.entry.filename" },
      options: {
        recursive: true,
        maxDepth: { expr: "$.entry.maxDepth" },
        filter: "*.txt"
      },
      metadata: {
        author: "system",
        timestamp: { expr: "$now()" }
      }
    },
    context,
    history,
    0
  );
  assert.equal(result.path, "/data/downloads/file.txt");
  assert.equal(result.options.recursive, true);
  assert.equal(result.options.maxDepth, 5);
  assert.equal(result.options.filter, "*.txt");
  assert.equal(result.metadata.author, "system");
  assert(typeof result.metadata.timestamp === "string");
});

test("should pass through empty object", async () => {
  const context = {};
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    {},
    context,
    history,
    0
  );
  assert.deepEqual(result, {});
});

test("should pass through empty array", async () => {
  const context = {};
  const history: NodeExecutionRecord[] = [];
  const result = await evaluateArgValue(
    [],
    context,
    history,
    0
  );
  assert.deepEqual(result, []);
});

test("should error on expression object with non-string expr", async () => {
  const context = {};
  const history: NodeExecutionRecord[] = [];
  await assert.rejects(
    async () => {
      await evaluateArgValue(
        { expr: 123 },
        context,
        history,
        0
      );
    },
    /Invalid expression object.*must be a string/
  );
});
