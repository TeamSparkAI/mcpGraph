# **MCP Graph: A No-Code Alternative to "Code Mode"**

## **The Rise of "Code Mode"**

In July of 2024, an academic paper published on the Apple Machine Learning Research blog dove into the implications of having Large Language Models write code to solve problems. That paper is: [CodeAct: Your LLM Agent Acts Better when Generating Code](https://machinelearning.apple.com/research/codeact). To put it very, very simply, the idea is that LLMs are not very good at solving a large swath of otherwise fairly simple problems, but they are very good at writing code to solve those same kinds of problems. An LLM can't reliably tell you how many times the letter "R" occurs in the word "strawberry", but it can easily and reliably write code in any language that can answer that question with 100% accuracy.

A little over a year later, during a ten day period starting in late September, 2025, several major players in the AI space published their approaches to orchestrating MCP servers in code, calling it "**Code Mode**". The idea, similar to the principle behind **CodeAct**, is that LLMs aren't very good at selecting from large catalogs of tools and calling the right tools in the right order, piping the proper data from one tool to the next, but they are exceptionally good at writing code to do that very thing.

[Cloudflare: Code Mode: the better way to use MCP](https://blog.cloudflare.com/code-mode/) (Sep 26, 2025\)

[Anthropic: Code execution with MCP: Building more efficient agents](https://www.anthropic.com/engineering/code-execution-with-mcp) (Nov 4, 2025\)

[Docker: Dynamic MCPs with Docker: Stop Hardcoding Your Agents’ World](https://www.docker.com/blog/dynamic-mcps-stop-hardcoding-your-agents-world/) (Nov 6, 2025\)

In addition to the quality and accuracy improvements that drove **CodeAct**, there were other factors that made **Code Mode** attractive. The core idea is that traditional tool calling is problematic in two specific ways:

1. **Context Window Overload:** Even with just a few MCP servers installed, an agent can be overwhelmed by hundreds of kilobytes of tool descriptions. These descriptions are sent with every request, consuming large amounts of tokens, even when most tools aren't relevant to most tasks.  
2. **The Intermediate Data Tax:** When performing a sequence of tool calls (for example, reading a transcript from a Google Doc to add it to a Salesforce prospect) the intermediate data (the transcript) must be sent back to the LLM before being passed to the next tool. This consumes massive amounts of tokens, sometimes across subsequent turns in the conversation history (as long as the intermediate data stays in context).

This token use isn't just a cost (and time) problem. The large context windows created by all of these tokens essentially distracts the model and dilutes the impact of other more relevant context, producing lower accuracy (often manifesting as poor reasoning).

### **The Code Mode Solution**

**Code Mode** suggests that instead of the LLM orchestrating these steps manually, it should write a small TypeScript or JavaScript "wrapper" MCP server. This wrapper handles the logic and data routing externally, returning only a concise result to the LLM. Anthropic reported that this approach reduced context usage by up to **98.7%**, significantly increasing speed, accuracy, and cost-efficiency.

## **The Problem with Code Mode**

While the solution works, it introduces a major challenge: **it’s still code.**

### **1\. The Security Attack Surface**

In fairness, the advocates of Code Mode do concede that the code needs to be run in a sandbox (with the Cloudflare and Docker solutions using integrated sandboxing).

But even with sandboxing, running LLM-generated code creates risks. These Code Mode tools are designed to interact with the outside world through a catalog of other tools. Those tools are often connected to systems like GitHub, Google Docs, or Salesforce, that provide attack vectors for both gathering and exfiltrating sensitive data.

This is especially concerning when considering the fact that we live in a world where prompt injections can mislead an agent into writing malicious logic that bypasses intended constraints (a problem that doesn't seem to be going away anytime soon).

And because it is code, you still have to worry about every other possible attack vector \- even if the code runs in a sandbox, offering what is essentially remote code execution as a service via prompt injection and Code Mode is not without risk.

### **2\. The Burden of Code**

Unless you are a move-fast-and-break-things startup, once you generate code, you have to treat it like code. You probably have coding standards and processes for working with code, including a system of compliance and security controls, and that stuff is all there for good reason. You can't just pretend that these chunks of AI-generated code are harmless artifacts in your too-complex-to-understand agent solution. 

If it's code (it is), then…

* Did anyone review and approve it?  
* Who maintains it?  
* Does it follow our coding standards?  
* Is it in version control?  
* Did it go through security reviews (SAST/DAST)?  
* Will it perform acceptably and will it scale?  
* Is it covered by our compliance systems and programs?  
* And about 100 more questions, because it's code.

## **The Proposal: A "No-Code" Code Mode**

We need a solution that offers the benefits of Code Mode without the risks of arbitrary code execution. What would be required to solve the kinds of problems that Code Mode is trying to solve?

The requirements are:

* **MCP tool calling:** We need to be able to call MCP tools (from a set we are provided).  
* **Data transformation:** We need to be able to transform data coming into our solution, between tool calls, and exiting our solution. This includes summarization, filtering, extraction, formatting, etc.  
* **Conditional logic:** We need to be able to apply conditional logic to our tool calling.  
* **Composable by agents:** Agents need to be able to compose these solutions, meaning they must be simple, and based on pre-existing standards, formats, and tooling on which agents have already been trained.  
* **Inspectable:** We need to be able to inspect the solution (by humans or with code) and easily understand exactly what it does.  
* **No embedded programming language:** We don't want to provide direct access to a programming language, or even the ability to "jailbreak" into an underlying language environment.

We should be able to solve all of that without a full-blown programming language.

### **Why not use existing workflow platforms?**

There are many commercial solutions to tool and API orchestration through workflows, like: n8n, Zapier, and Workato. These platforms are currently used by humans to build workflows exposed as MCP tools that agents can call. And that is fine as long as appropriate controls are in place.

But that's not what we're talking about. We're talking about a solution where we turn an agent loose to build its own workflows and then run them (with little to no supervision), and these platforms lack the security controls to make that tenable. At very best, they would be no better than Code Mode.

---

## **Introducing MCP Graph**

**MCP Graph** is a Domain Specific Language (DSL) for MCP tool orchestration. It uses a declarative configuration—a YAML file—to define an MCP server and a set of tools, where those tools are implemented as directed graphs that can orchestrate other MCP tools (with data transformation and conditional logic support). It's Code Mode without the code.

### **Core Features:**

* **Declarative Config:** Define tools and execution graphs in YAML.  
* **Data Transformation:** Uses **JSONata** to transform data between nodes.  
* **Conditional Routing:** Uses **JSON Logic** for branching.  
* **Observability:** Every tool call, data transformation, and decision is traceable in real time and auditable after the fact.  
* **No JavaScript (or other language environment):** No opportunity for malicious code injection.

### **The Execution Graph**

An MCP Graph definition consists of five node types:

1. **Entry Node:** Maps input parameters to the graph.  
2. **MCP Node:** Calls an external MCP tool.  
3. **Transform Node:** Uses JSONata to format or extract data.  
4. **Switch Node:** Implements conditional logic using JSON Logic.  
5. **Exit Node:** Returns the final result to the agent.

---

## **Example: The `count_files` Tool**

Imagine a tool that counts files in a directory. Traditionally, the agent would call a filesystem MCP server tool to list a directory, then it would parse the output and attempt to count the files it found. In MCP Graph, the flow looks like this:

1. **Entry:** Takes the `directory` path.  
2. **MCP Call:** Calls the `list_directory` tool from a File System MCP server.  
3. **Transform:** Uses a JSONata expression to split the output into lines and count them.  
4. **Exit:** Returns a simple JSON object: `{ "count": 7 }`.

This entire process happens outside the LLM's context window. The model provides only the target directory and only sees the final count.

Here is what that looks like in YAML.

First, we describe this MCP server...

```yaml
Server:
  name: "fileUtils"
  version: "1.0.0"    
  title: "File utilities"
  instructions: "This server provides file utility tools."
```

Then we describe the MCP servers that it can use...

```yaml
# MCP Servers used by the graph
mcpServers:
  filesystem:
    command: "npx"
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "../path/to/directory"
```

And finally we describe the tools we export, including their parameters and the graph that they execute...

```yaml
# Tool Definitions
tools:
  - name: "count_files"
    description: "Counts the number of files in a directory"
    inputSchema:
      type: "object"
      properties:
        directory:
          type: "string"
          description: "The directory path to count files in"
      required:
        - directory
    outputSchema:  
      type: "object"
      properties: 
        count:
          type: "number"
          description: "The number of files in the directory"
    nodes:
      # Entry node: Receives tool arguments
      - id: "entry"
        type: "entry"
        next: "list_directory_node"
      # List directory contents
      - id: "list_directory_node"
        type: "mcp"
        server: "filesystem"
        tool: "list_directory"
        args:
          path: "$.entry.directory" # Use "directory" param from tool call
        next: "count_files_node" 
      # Transform and count files
      - id: "count_files_node" 
        type: "transform"
        transform:
          expr: '{ "count": $count($split($.list_directory_node.content, "\n")) }'
        next: "exit"
      # Exit node: Returns the count
      - id: "exit"
        type: "exit"
```

## **Deploying an mcpGraph to an Agent**

To deploy the above mcpGraph to an agent, you would simply install mcpGraph:

```bash
npm install -g mcpGraph
```

Then add the mcpGraph MCP server to your agent config (mcp.json or equivalent):

```json
{
  "mcpServers": {
    "mcpgraph": {
      "command": "mcpgraph",
      "args": [
        "-g",
        "/path/to/your/mcpgraph.yaml"
      ]
    }
  }
}
```

Once configured, your agent will now see an MCP server called `fileUtils` and a tool called `count_files` that it can run just like any other tool.

## **Developer Experience (MCP Graph UX)**

To make this observable and testable, we’ve built **MCP Graph UX**, a separate project that allows you to:

* Visualize the graph structure.  
* Animate through active nodes during execution.  
* Set breakpoints and step through transformations.  
* Inspect the exact input and output of every node.

Install it and run it via npm:

```bash
npm install -g mcpgraph-ux
npm run server 3001 ../path/to/mcpgraph.yaml
```

## **Agent Support**

In order for this to work as advertised, agents need to be able to compose and use mcpGraphs.  This is a point that the other papers have pretty much glossed over (they explain how the agents built the tools and the structure of the resulting tools, but not so much on how the agents were prompted and how the tools then found their way into the agent environment).  I'll give Docker a pass, since they're making the composed tools available via an MCP gateway.

Assuming your agent can build and install an MCP server into it's own environment, we have provided a SKILL.md file to support agents in understanding how to build and install an mcpGraph as an MCP server.

**mcpGraphToolkit**

We also wanted a viable end-to-end solution where any agent could create and deploy mcpGraph tools. This means that we not only need to instruct the agent on tool creation, but we need to provide the agent with tooling to test and deploy tools into its own environment. To that end, we created mcpGraphToolkit, an MCP server that provides a full set of development, test, and deployment tools to an agent. We have a separate SKILL.md file to support agents in using the mcpGraphToolkit.

The **mpcGraphToolkit** is installed as part of the mcpGraph package, so if you've installed mcpGraph from npm, you already have mcpGraphToolkit available.

To use mcpGraphToolkit in your agent:

```json
{
  "mcpServers": {
    "mcpgraphtoolkit": {
      "command": "mcpgraphtoolkit",
      "args": ["-g", "/path/to/your/graph.yaml", "-m", "/path/to/mcp.json"]
    }
  }
}
```

When using **mcpGraphToolkit** you pass an path to your mcpGraph file, as before, and you also pass a path to an mcp.json file containing mcpServers (this file can be any name and can be the same file your agent uses if you want access to the full set of tools your agent has).

**mcpGraphToolkit** then exposes the following tools to your agent:

### Graph Discovery Tools
- **`getGraphServer`**: Get full details of the mcpGraph server metadata (name, version, title, instructions)
- **`listGraphTools`**: List all exported tools from the mcpGraph (name and description)
- **`getGraphTool`**: Get full detail of an exported tool from the mcpGraph (including complete node definitions)

### MCP Server Discovery Tools
- **`listMcpServers`**: List all available MCP servers (name, title, instructions, version)
- **`listMcpServerTools`**: List tools from MCP servers (name/description only), optionally filtered by MCP server name
- **`getMcpServerTool`**: Get full MCP server tool details (including input and output schemas)

### Graph Tool Management Tools
- **`addGraphTool`**: Add a new tool to the mcpGraph
- **`updateGraphTool`**: Update an existing tool in the mcpGraph
- **`deleteGraphTool`**: Delete a tool from the mcpGraph

### Tool Execution Tools
- **`runGraphTool`**: Run an exported tool from the mcpGraph. Can specify existing tool name or run a tool definition supplied in payload. Supports optional logging collection.

### Expression Testing Tools
- **`testJSONata`**: Test a JSONata expression with context
- **`testJSONLogic`**: Test a JSON Logic expression with context

With these tools, and guided by the SKILL.md, any agent should be able to compose, test, deploy, any call mcpGraph tools.

## **Conclusion**

MCP Graph provides the context efficiency and accuracy of Code Mode while maintaining the security and observability of a no-code solution. It is currently available via NPM under the MIT license.

https://github.com/TeamSparkAI/mcpGraph

https://github.com/TeamSparkAI/mcpGraph-ux

https://www.npmjs.com/package/mcpgraph

https://www.npmjs.com/package/mcpgraph-ux

