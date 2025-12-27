# Counting Test Files

This directory contains sample files used for testing file counting operations.

These files are **not** referenced directly by tests - they are simply files that exist in this directory. The `count_files` example tool counts all files in this directory using the filesystem MCP server's `list_directory` tool.

The test verifies that:
- The counting operation works correctly
- The result is a valid number
- The filesystem MCP server integration works

The actual files present don't matter - any files in this directory will be counted.

