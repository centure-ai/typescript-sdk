# @centure/node-sdk

A fully type-safe TypeScript SDK for interacting with Centure's API for prompt injection detection.

## Installation

```bash
npm install @centure/node-sdk
```

## Usage

### Initialize the Client

```typescript
import { CentureClient } from "@centure/node-sdk";

// Using environment variable CENTURE_API_KEY
const client = new CentureClient();

// Or provide API key directly
const client = new CentureClient({
  apiKey: "your-api-key",
  baseUrl: "https://api.centure.ai", // Optional, defaults to production
});
```

### Scan Text for Prompt Injection

```typescript
const result = await client.scanText("Your text content here");

console.log("Is safe:", result.is_safe);
console.log("Detected categories:", result.categories);
console.log("Request ID:", result.request_id);
```

### Scan Image (Base64 or Buffer)

```typescript
// Using base64 string
const base64Image = "iVBORw0KGgoAAAANSUhEUgAA...";
const result = await client.scanImage(base64Image);

console.log("Is safe:", result.is_safe);
console.log("Detected threats:", result.categories);
```

```typescript
// Using Buffer (Node.js) - automatically converted to base64
import fs from "fs";

const imageBuffer = fs.readFileSync("./image.png");
const result = await client.scanImage(imageBuffer);
```

## API Response

All scan methods return a `ScanResponse` object:

```typescript
interface ScanResponse {
  is_safe: boolean;
  categories: DetectedCategory[];
  request_id: string;
  api_key_id: string;
  request_units: number;
  service_tier: ServiceTier;
}

interface DetectedCategory {
  code: ThreatCategory;
  confidence: ConfidenceLevel;
}
```

## MCP Integration

The SDK provides a transport wrapper for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) that automatically scans messages for prompt injection attacks.

### CentureMCPClientTransport

The `CentureMCPClientTransport` wraps any MCP transport and intercepts messages to scan them for security threats before they reach your MCP server.

#### Basic Usage

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CentureClient } from "@centure/node-sdk";
import { CentureMCPClientTransport } from "@centure/node-sdk/mcp";

// Create your underlying MCP transport
const stdioTransport = new StdioClientTransport({
  command: "your-mcp-server",
  args: ["--arg1", "--arg2"],
});

// Wrap it with Centure security scanning
const secureTransport = new CentureMCPClientTransport({
  client: new CentureClient({
    apiKey: "your-api-key",
  }),
  transport: stdioTransport,
});

// Use with MCP client
const client = new Client({
  name: "your-client",
  version: "1.0.0",
});

await client.connect(secureTransport);
```

#### Configuration Parameters

##### Required Parameters

- **`transport`** (`Transport`): The underlying MCP transport to wrap (e.g., StdioClientTransport, SSEClientTransport)
- **`client`** (`CentureClient`): Centure API client instance for scanning messages

##### Optional Hooks

- **`shouldScanMessage`** (`(context: ShouldScanMessageContext) => boolean | ShouldScanMessageResult`):

  Determines whether a specific message should be scanned. Return `false` or `{ scan: false }` to skip scanning.

  ```typescript
  shouldScanMessage: ({ message, extra }) => {
    // Skip scanning for tool list requests
    if (message.method === "tool/list") {
      return false;
    }
    return true;
  }
  ```

- **`onAfterScan`** (`(context: OnAfterScanContext) => void | OnAfterScanResult`):

  Called after a message is scanned, regardless of the result. Can return `{ passthrough: true }` to allow the message even if unsafe.

  ```typescript
  onAfterScan: ({ message, scanResult }) => {
    console.log(`Scanned ${message.method}: ${scanResult.is_safe}`);
  }
  ```

- **`onUnsafeMessage`** (`(context: OnUnsafeMessageContext) => OnUnsafeMessageResult`):

  Called when an unsafe message is detected. Must return an object specifying whether to allow or block the message.

  ```typescript
  onUnsafeMessage: ({ message, scanResult }) => {
    // Allow medium-confidence threats
    const isMedium = scanResult.categories.every(
      (c) => c.confidence === "medium"
    );

    if (isMedium) {
      return { passthrough: true };
    }

    // Block high-confidence threats with custom error
    return {
      passthrough: false,
      replace: {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32001,
          message: "Security violation detected",
        },
      },
    };
  }
  ```

- **`onBeforeSend`** (`(context: { message: JSONRPCMessage, extra?: MessageExtraInfo }) => void`):

  Called before any message is sent through the transport.

  ```typescript
  onBeforeSend: ({ message, extra }) => {
    console.log(`Sending ${message.method}`);
  }
  ```

#### Complete Example

```typescript
const secureTransport = new CentureMCPClientTransport({
  client: new CentureClient({
    baseUrl: "http://localhost:3001",
    apiKey: "your-api-key",
  }),
  transport: stdioTransport,

  shouldScanMessage: ({ message }) => {
    // Skip scanning for certain safe methods
    if (message.method === "tool/list") {
      return false;
    }
    return true;
  },

  onUnsafeMessage: ({ message, scanResult }) => {
    // Allow medium-confidence detections
    const isMedium = scanResult.categories.every(
      (c) => c.confidence === "medium"
    );

    if (isMedium) {
      return { passthrough: true };
    }

    // Block high-confidence threats
    return {
      passthrough: false,
      replace: {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32001,
          message: "Unsafe Message!",
        },
      },
    };
  },
});
```

#### Hook Types

```typescript
type ShouldScanMessageContext = {
  message: JSONRPCMessage;
  extra?: MessageExtraInfo;
};

type OnAfterScanContext = {
  message: JSONRPCMessage;
  extra?: MessageExtraInfo;
  scanResult: ScanResponse;
};

type OnUnsafeMessageContext = {
  message: JSONRPCMessage;
  extra?: MessageExtraInfo;
  scanResult: ScanResponse;
};

type OnUnsafeMessageResult = {
  passthrough: boolean;
  replace?: JSONRPCMessage;
};
```

## Error Handling

The SDK provides specific error classes for different scenarios:

```typescript
import {
  CentureClient,
  BadRequestError,
  UnauthorizedError,
  PayloadTooLargeError,
  MissingApiKeyError,
} from "@centure/node-sdk";

try {
  const result = await client.scanText("content");
} catch (error) {
  if (error instanceof UnauthorizedError) {
    console.error("Invalid API key");
  } else if (error instanceof BadRequestError) {
    console.error("Invalid request:", error.message);
  } else if (error instanceof PayloadTooLargeError) {
    console.error("Image too large");
  }
}
```

## Configuration

### Custom Fetch Options

```typescript
const client = new CentureClient({
  apiKey: "your-api-key",
  fetchOptions: {
    timeout: 30000,
    headers: {
      "X-Custom-Header": "value",
    },
  },
});
```

### Custom Fetch Implementation

```typescript
import fetch from "node-fetch";

const client = new CentureClient({
  apiKey: "your-api-key",
  fetch: fetch as any,
});
```

## Threat Categories

The API detects the following threat categories:

- `behavioral_override_low` - Attempts to override system behavior
- `role_manipulation` - Attempts to manipulate the AI's role
- `context_injection` - Injection of malicious context
- `instruction_hierarchy_manipulation` - Manipulation of instruction priority
- `output_manipulation` - Attempts to control output format
- `data_exfiltration` - Attempts to extract sensitive data
- `external_actions` - Attempts to trigger external actions
- `safety_bypass` - Attempts to bypass safety measures

## License

MIT
