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
  const result = await api.executeTool('count_files', {
    directory: './tests/files',
  });

  console.log('Execution result:', result.result);
  console.log('Structured content:', result.structuredContent);

  // Clean up resources
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
  example().catch(console.error);
}

