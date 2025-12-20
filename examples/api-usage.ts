/**
 * Example: Using the mcpGraph API programmatically
 * 
 * This example shows how to use the McpGraphApi class in your own applications,
 * such as a UX server or other programmatic interface.
 */

import { McpGraphApi } from '../src/api.js';

async function example() {
  // Create an API instance (loads and validates config)
  const api = new McpGraphApi('examples/count_files.yaml');

  // Get server information
  const serverInfo = api.getServerInfo();
  console.log(`Server: ${serverInfo.name} v${serverInfo.version}`);

  // List all available tools
  const tools = api.listTools();
  console.log(`Available tools: ${tools.map(t => t.name).join(', ')}`);

  // Get information about a specific tool
  const toolInfo = api.getTool('count_files');
  if (toolInfo) {
    console.log(`Tool: ${toolInfo.name}`);
    console.log(`Description: ${toolInfo.description}`);
  }

  // Execute a tool
  const { promise } = api.executeTool('count_files', {
    directory: './tests/files',
  });
  const result = await promise;

  console.log('Execution result:', result.result);
  console.log('Structured content:', result.structuredContent);

  // Clean up resources
  await api.close();
}

// Example: Using introspection and debugging features
async function introspectionExample() {
  const api = new McpGraphApi('examples/count_files.yaml');

  // Execute with hooks and telemetry
  const { promise, controller } = api.executeTool('count_files', {
    directory: './tests/files',
  }, {
    hooks: {
      onNodeStart: async (nodeId, node) => {
        console.log(`[Hook] Starting node: ${nodeId} (${node.type})`);
        return true; // Continue execution
      },
      onNodeComplete: async (nodeId, node, input, output, duration) => {
        console.log(`[Hook] Node ${nodeId} completed in ${duration}ms`);
      },
    },
    enableTelemetry: true,
  });
  
  // Controller is available immediately (no polling needed)
  if (controller) {
    console.log('Controller available for pause/resume/stop');
  }
  
  const result = await promise;

  // Access execution history
  if (result.executionHistory) {
    console.log('\nExecution History:');
    for (const record of result.executionHistory) {
      console.log(`  ${record.nodeId} (${record.nodeType}): ${record.duration}ms`);
    }
  }

  // Access telemetry
  if (result.telemetry) {
    console.log('\nTelemetry:');
    console.log(`  Total duration: ${result.telemetry.totalDuration}ms`);
    console.log(`  Errors: ${result.telemetry.errorCount}`);
    for (const [nodeType, duration] of result.telemetry.nodeDurations) {
      const count = result.telemetry.nodeCounts.get(nodeType) || 0;
      console.log(`  ${nodeType}: ${count} executions, ${duration}ms total`);
    }
  }

  await api.close();
}

// Example: Validate config without creating an API instance
function validateConfigExample() {
  const errors = McpGraphApi.validateConfig('examples/count_files.yaml');
  if (errors.length > 0) {
    console.error('Validation errors:');
    for (const error of errors) {
      console.error(`  - ${error.message}`);
    }
  } else {
    console.log('Config is valid!');
  }
}

// Example: Load and validate config
function loadAndValidateExample() {
  const { config, errors } = McpGraphApi.loadAndValidateConfig('examples/count_files.yaml');
  if (errors.length > 0) {
    console.error('Validation errors:', errors);
  } else {
    console.log('Config loaded successfully');
    console.log(`Tools: ${config.tools.map(t => t.name).join(', ')}`);
  }
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  const exampleToRun = process.argv[2] || 'basic';
  
  if (exampleToRun === 'introspection') {
    introspectionExample().catch(console.error);
  } else {
    example().catch(console.error);
  }
}

