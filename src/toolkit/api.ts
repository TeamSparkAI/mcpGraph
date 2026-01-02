/**
 * ToolkitApi - Thin wrapper that exposes McpGraphApi methods as MCP tools
 * 
 * This class wraps McpGraphApi and provides MCP tool handlers.
 * It does NOT implement core graph functionality - it leverages McpGraphApi.
 */

import { McpGraphApi } from '../api.js';
import type { ToolDefinition } from '../types/config.js';
import type { ExecutionOptions } from '../types/execution.js';
import { McpDiscovery } from './mcp-discovery.js';
import { testJSONata, testJSONLogic, testMcpTool } from './expression-testers.js';

export interface ToolkitTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export class ToolkitApi {
  private api: McpGraphApi;
  private mcpDiscovery: McpDiscovery | null = null;

  constructor(api: McpGraphApi, mcpFilePath?: string | null) {
    this.api = api;
    if (mcpFilePath) {
      this.mcpDiscovery = new McpDiscovery(mcpFilePath);
    }
  }

  /**
   * Get the underlying McpGraphApi instance
   */
  getApi(): McpGraphApi {
    return this.api;
  }

  /**
   * Get list of all toolkit tools
   */
  listTools(): ToolkitTool[] {
    return [
      {
        name: 'getGraphServer',
        description: 'Get full details of the mcpGraph server metadata',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Server name' },
            version: { type: 'string', description: 'Server version' },
            title: { type: 'string', description: 'Server title' },
            instructions: { type: 'string', description: 'Server instructions' },
          },
          required: ['name', 'version'],
        },
      },
      {
        name: 'listGraphTools',
        description: 'List all exported tools from the mcpGraph (name and description)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Tool name' },
                  description: { type: 'string', description: 'Tool description' },
                },
                required: ['name', 'description'],
              },
            },
          },
        },
      },
      {
        name: 'getGraphTool',
        description: 'Get full detail of an exported tool from the mcpGraph',
        inputSchema: {
          type: 'object',
          properties: {
            toolName: {
              type: 'string',
              description: 'Name of the tool to get',
            },
          },
          required: ['toolName'],
        },
        outputSchema: {
          type: 'object',
          description: 'Complete tool definition including name, description, inputSchema, outputSchema, and nodes',
          properties: {},
        },
      },
      {
        name: 'listMcpServers',
        description: 'List all available MCP servers (name, title, instructions, version)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Server name' },
                  title: { type: 'string', description: 'Server title' },
                  instructions: { type: 'string', description: 'Server instructions' },
                  version: { type: 'string', description: 'Server version' },
                },
                required: ['name'],
              },
            },
          },
        },
      },
      {
        name: 'listMcpServerTools',
        description: 'List tools from MCP servers (name/description only), optionally filtered by MCP server name',
        inputSchema: {
          type: 'object',
          properties: {
            serverName: {
              type: 'string',
              description: 'Optional server name to filter by',
            },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Tool name' },
                  description: { type: 'string', description: 'Tool description' },
                  server: { type: 'string', description: 'MCP server name' },
                },
                required: ['name', 'description', 'server'],
              },
            },
          },
        },
      },
      {
        name: 'getMcpServerTool',
        description: 'Get full MCP server tool details (including input and output schemas)',
        inputSchema: {
          type: 'object',
          properties: {
            serverName: {
              type: 'string',
              description: 'Name of the MCP server',
            },
            toolName: {
              type: 'string',
              description: 'Name of the tool',
            },
          },
          required: ['serverName', 'toolName'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool name' },
            description: { type: 'string', description: 'Tool description' },
            inputSchema: { type: 'object', description: 'Tool input schema' },
            outputSchema: { type: 'object', description: 'Tool output schema' },
          },
          required: ['name', 'description', 'inputSchema'],
        },
      },
      {
        name: 'addGraphTool',
        description: 'Add a new tool to the mcpGraph',
        inputSchema: {
          type: 'object',
          properties: {
            tool: {
              type: 'object',
              description: 'Complete tool definition',
            },
          },
          required: ['tool'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', description: 'Whether the operation succeeded' },
            message: { type: 'string', description: 'Success message' },
          },
          required: ['success', 'message'],
        },
      },
      {
        name: 'updateGraphTool',
        description: 'Update an existing tool in the mcpGraph',
        inputSchema: {
          type: 'object',
          properties: {
            toolName: {
              type: 'string',
              description: 'Name of the tool to update',
            },
            tool: {
              type: 'object',
              description: 'Updated tool definition',
            },
          },
          required: ['toolName', 'tool'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', description: 'Whether the operation succeeded' },
            message: { type: 'string', description: 'Success message' },
          },
          required: ['success', 'message'],
        },
      },
      {
        name: 'deleteGraphTool',
        description: 'Delete a tool from the mcpGraph',
        inputSchema: {
          type: 'object',
          properties: {
            toolName: {
              type: 'string',
              description: 'Name of the tool to delete',
            },
          },
          required: ['toolName'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', description: 'Whether the operation succeeded' },
            message: { type: 'string', description: 'Success message' },
          },
          required: ['success', 'message'],
        },
      },
      {
        name: 'runGraphTool',
        description: 'Run an exported tool from the mcpGraph. Can specify existing tool name or run a tool definition supplied in payload.',
        inputSchema: {
          type: 'object',
          properties: {
            toolName: {
              type: 'string',
              description: 'Name of existing tool to run (optional if toolDefinition provided)',
            },
            toolDefinition: {
              type: 'object',
              description: 'Tool definition to run inline (optional if toolName provided)',
            },
            arguments: {
              type: 'object',
              description: 'Tool input arguments',
            },
            logging: {
              type: 'boolean',
              description: 'Include execution logging in response',
            },
          },
          required: ['arguments'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { 
              type: 'object',
              description: 'Tool execution result (type depends on tool)',
            },
            logging: {
              type: 'array',
              description: 'Execution logs (present if logging was enabled)',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'string', description: 'Log level' },
                  message: { type: 'string', description: 'Log message' },
                  timestamp: { type: 'string', description: 'Log timestamp' },
                  args: { type: 'array', description: 'Additional log arguments' },
                },
                required: ['level', 'message', 'timestamp'],
              },
            },
            executionHistory: {
              type: 'array',
              description: 'Execution history for debugging (if available)',
              items: { type: 'object' },
            },
          },
          required: ['result'],
        },
      },
      {
        name: 'testJSONata',
        description: 'Test a JSONata expression with context',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'JSONata expression to test',
            },
            context: {
              type: 'object',
              description: 'Context object for evaluation',
            },
          },
          required: ['expression', 'context'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { 
              type: 'object',
              description: 'Expression evaluation result (type depends on expression)',
            },
            error: {
              type: 'object',
              description: 'Error details (present if evaluation failed)',
              properties: {
                message: { type: 'string', description: 'Error message' },
                details: { 
                  type: 'object',
                  description: 'Additional error details',
                },
              },
              required: ['message'],
            },
          },
        },
      },
      {
        name: 'testJSONLogic',
        description: 'Test a JSON Logic expression with context',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'object',
              description: 'JSON Logic expression object',
            },
            context: {
              type: 'object',
              description: 'Context object for evaluation',
            },
          },
          required: ['expression', 'context'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { 
              type: 'boolean',
              description: 'Expression evaluation result (typically boolean for conditions)',
            },
            error: {
              type: 'object',
              description: 'Error details (present if evaluation failed)',
              properties: {
                message: { type: 'string', description: 'Error message' },
                details: { 
                  type: 'object',
                  description: 'Additional error details',
                },
              },
              required: ['message'],
            },
          },
        },
      },
      {
        name: 'testMcpTool',
        description: 'Test an MCP tool call directly. Evaluates JSONata expressions in args if context is provided.',
        inputSchema: {
          type: 'object',
          properties: {
            server: {
              type: 'string',
              description: 'Name of the MCP server',
            },
            tool: {
              type: 'string',
              description: 'Name of the tool to call',
            },
            args: {
              type: 'object',
              description: 'Tool arguments (values starting with $ are evaluated as JSONata if context is provided)',
            },
            context: {
              type: 'object',
              description: 'Optional context object for JSONata expression evaluation in args',
            },
          },
          required: ['server', 'tool', 'args'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            output: { 
              type: 'object',
              description: 'Tool execution output - matches what would be available in a graph node\'s execution context. The structure depends on the tool\'s response format (structuredContent if present, otherwise parsed/raw content). The output may be an object, string, or other type depending on how the underlying tool returns data. Use getMcpServerTool to understand the underlying tool\'s outputSchema and expected output structure.',
            },
            evaluatedArgs: {
              type: 'object',
              description: 'Evaluated arguments (present if JSONata expressions were used)',
            },
            executionTime: {
              type: 'number',
              description: 'Execution time in milliseconds',
            },
            error: {
              type: 'object',
              description: 'Error details (present if call failed)',
              properties: {
                message: { type: 'string', description: 'Error message' },
                details: { 
                  type: 'object',
                  description: 'Additional error details',
                },
              },
              required: ['message'],
            },
          },
          required: ['output', 'executionTime'],
        },
      },
    ];
  }

  /**
   * Handle tool call
   */
  async callTool(toolName: string, arguments_: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getGraphServer': {
        const serverInfo = this.api.getServerInfo();
        return {
          name: serverInfo.name,
          version: serverInfo.version,
          title: serverInfo.title,
          instructions: serverInfo.instructions,
        };
      }

      case 'listGraphTools': {
        const tools = this.api.listTools();
        return {
          items: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
          })),
        };
      }

      case 'getGraphTool': {
        const toolName_ = arguments_.toolName as string;
        if (!toolName_) {
          throw new Error('toolName is required');
        }
        const config = this.api.getConfig();
        const tool = config.tools.find(t => t.name === toolName_);
        if (!tool) {
          throw new Error(`Tool "${toolName_}" not found`);
        }
        return tool;
      }

      case 'listMcpServers': {
        if (!this.mcpDiscovery) {
          throw new Error('MCP file not provided (use -m/--mcp flag)');
        }
        return {
          items: await this.mcpDiscovery.listServers(),
        };
      }

      case 'listMcpServerTools': {
        if (!this.mcpDiscovery) {
          throw new Error('MCP file not provided (use -m/--mcp flag)');
        }
        const serverName = arguments_.serverName as string | undefined;
        return {
          items: await this.mcpDiscovery.listTools(serverName),
        };
      }

      case 'getMcpServerTool': {
        if (!this.mcpDiscovery) {
          throw new Error('MCP file not provided (use -m/--mcp flag)');
        }
        const serverName = arguments_.serverName as string;
        const toolName_ = arguments_.toolName as string;
        if (!serverName || !toolName_) {
          throw new Error('serverName and toolName are required');
        }
        return await this.mcpDiscovery.getTool(serverName, toolName_);
      }

      case 'addGraphTool': {
        const tool = arguments_.tool as ToolDefinition;
        if (!tool) {
          throw new Error('tool is required');
        }
        this.api.addTool(tool);
        this.api.save();
        return { success: true, message: `Tool "${tool.name}" added successfully` };
      }

      case 'updateGraphTool': {
        const toolName_ = arguments_.toolName as string;
        const tool = arguments_.tool as ToolDefinition;
        if (!toolName_ || !tool) {
          throw new Error('toolName and tool are required');
        }
        this.api.updateTool(toolName_, tool);
        this.api.save();
        return { success: true, message: `Tool "${toolName_}" updated successfully` };
      }

      case 'deleteGraphTool': {
        const toolName_ = arguments_.toolName as string;
        if (!toolName_) {
          throw new Error('toolName is required');
        }
        this.api.deleteTool(toolName_);
        this.api.save();
        return { success: true, message: `Tool "${toolName_}" deleted successfully` };
      }

      case 'runGraphTool': {
        const toolName_ = arguments_.toolName as string | undefined;
        const toolDefinition = arguments_.toolDefinition as ToolDefinition | undefined;
        const toolArguments = (arguments_.arguments || {}) as Record<string, unknown>;
        const enableLogging = (arguments_.logging === true);

        if (!toolName_ && !toolDefinition) {
          throw new Error('Either toolName or toolDefinition must be provided');
        }
        if (toolName_ && toolDefinition) {
          throw new Error('Cannot specify both toolName and toolDefinition');
        }

        const options: ExecutionOptions = {
          enableLogging,
        };

        let executionResult;
        if (toolName_) {
          const { promise } = this.api.executeTool(toolName_, toolArguments, options);
          executionResult = await promise;
        } else {
          executionResult = await this.api.executeToolDefinition(toolDefinition!, toolArguments, options);
        }

        const result: Record<string, unknown> = {
          result: executionResult.result,
        };

        if (executionResult.logs) {
          result.logging = executionResult.logs;
        }

        if (executionResult.executionHistory) {
          // Include execution history for debugging if available
          result.executionHistory = executionResult.executionHistory;
        }

        return result;
      }

      case 'testJSONata': {
        const expression = arguments_.expression as string;
        const context = (arguments_.context || {}) as Record<string, unknown>;
        
        if (!expression) {
          throw new Error('expression is required');
        }
        
        const testResult = await testJSONata(expression, context);
        
        if (testResult.error) {
          return {
            result: null,
            error: testResult.error,
          };
        }
        
        return {
          result: testResult.result,
        };
      }

      case 'testJSONLogic': {
        const expression = arguments_.expression as unknown;
        const context = (arguments_.context || {}) as Record<string, unknown>;
        
        if (!expression) {
          throw new Error('expression is required');
        }
        
        const testResult = await testJSONLogic(expression, context);
        
        if (testResult.error) {
          return {
            result: null,
            error: testResult.error,
          };
        }
        
        return {
          result: testResult.result,
        };
      }

      case 'testMcpTool': {
        const server = arguments_.server as string;
        const tool = arguments_.tool as string;
        const args = (arguments_.args || {}) as Record<string, unknown>;
        const context = arguments_.context as Record<string, unknown> | undefined;
        
        if (!server) {
          throw new Error('server is required');
        }
        if (!tool) {
          throw new Error('tool is required');
        }
        
        const testResult = await testMcpTool(this.api, server, tool, args, context);
        
        if (testResult.error) {
          return {
            output: null,
            evaluatedArgs: testResult.evaluatedArgs,
            executionTime: testResult.executionTime,
            error: testResult.error,
          };
        }
        
        return {
          output: testResult.output,
          evaluatedArgs: testResult.evaluatedArgs,
          executionTime: testResult.executionTime,
        };
      }

      default:
        throw new Error(`Tool "${toolName}" not implemented`);
    }
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    if (this.mcpDiscovery) {
      await this.mcpDiscovery.close();
    }
    await this.api.close();
  }
}

