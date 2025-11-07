import {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  JSONRPCMessage,
  MessageExtraInfo,
  RequestId,
} from "@modelcontextprotocol/sdk/types.js";
import { CentureClient } from "../client.js";
import { ScanResponse } from "../types.js";
import { isImageMimeType } from "../utils/is-image.js";

/**
 * JSONRPC error code for security violations detected by Centure scan.
 * Falls within the implementation-specific server error range (-32000 to -32099).
 */
export const CENTURE_SECURITY_VIOLATION_ERROR = -32001;

/**
 * Context passed to shouldScanMessage hook
 */
export type ShouldScanMessageContext = {
  message: JSONRPCMessage;
  extra?: MessageExtraInfo;
};

/**
 * Context passed to onAfterScan hook
 */
export type OnAfterScanContext = {
  message: JSONRPCMessage;
  extra?: MessageExtraInfo;
  scanResult: ScanResponse;
};

/**
 * Context passed to onUnsafeMessage hook
 */
export type OnUnsafeMessageContext = {
  message: JSONRPCMessage;
  extra?: MessageExtraInfo;
  scanResult: ScanResponse;
};

/**
 * Result type for shouldScanMessage hook
 */
export type ShouldScanMessageResult = {
  scan: boolean;
};

/**
 * Result type for onAfterScan hook
 */
export type OnAfterScanResult = {
  /**
   * If true, the message will be passed through without further checks
   */
  passthrough: boolean;
};

/**
 * Result type for onUnsafeMessage hook
 * - If passthrough is false, an error will be sent to the client
 * - If replace is provided, that message will be sent instead of an error
 */
export type OnUnsafeMessageResult = {
  passthrough: boolean;
  replace?: JSONRPCMessage;
};

/**
 * Configuration options for CentureMCPClientTransport.
 */
export type CentureMCPClientTransportOptions = {
  /**
   * The underlying transport to wrap.
   */
  transport: Transport;

  /**
   * Centure API client for scanning messages.
   */
  client: CentureClient;

  /**
   * Optional hook to determine if a message should be scanned.
   * Called before scanning each incoming message from server to client.
   * Can be sync or async.
   */
  shouldScanMessage?: (
    context: ShouldScanMessageContext,
  ) => boolean | Promise<boolean>;

  /**
   * Optional hook called after scanning a message.
   * Can be used for logging or custom logic based on scan results.
   * Can be sync or async.
   */
  onAfterScan?: (
    context: OnAfterScanContext,
  ) => OnAfterScanResult | Promise<OnAfterScanResult>;

  /**
   * Optional hook invoked when an unsafe message is detected.
   * Allows the caller to decide whether to pass through or replace the message.
   * Can be sync or async.
   */
  onUnsafeMessage?: (
    context: OnUnsafeMessageContext,
  ) => OnUnsafeMessageResult | Promise<OnUnsafeMessageResult>;
};

export class CentureMCPClientTransport implements Transport {
  private readonly wrappedTransport: Transport;
  private readonly client: CentureClient;
  private readonly shouldScanMessageHook?: CentureMCPClientTransportOptions["shouldScanMessage"];
  private readonly onAfterScanHook?: CentureMCPClientTransportOptions["onAfterScan"];
  private readonly onUnsafeMessageHook?: CentureMCPClientTransportOptions["onUnsafeMessage"];

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  constructor(options: CentureMCPClientTransportOptions) {
    this.wrappedTransport = options.transport;
    this.client = options.client;
    this.shouldScanMessageHook = options.shouldScanMessage;
    this.onAfterScanHook = options.onAfterScan;
    this.onUnsafeMessageHook = options.onUnsafeMessage;
  }

  /**
   * Creates a JSONRPC error response for an unsafe message
   * For tools/call, returns CallToolResult format with isError flag
   * For all other methods, returns standard JSON-RPC error format
   */
  private createErrorResponse(
    requestId: RequestId,
    method: string | undefined,
    scanResult: ScanResponse,
  ): JSONRPCMessage {
    // For tools/call, use CallToolResult format with isError
    if (method === "tools/call") {
      return {
        jsonrpc: "2.0" as const,
        id: requestId,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                code: CENTURE_SECURITY_VIOLATION_ERROR,
                message: "Message blocked by Centure security scan",
                data: {
                  categories: scanResult.categories,
                  reason: "Unsafe content detected",
                },
              }),
            },
          ],
        },
      };
    }

    // For all other methods (tools/list, resources/list, etc.), use standard JSON-RPC error format
    return {
      jsonrpc: "2.0" as const,
      id: requestId,
      error: {
        code: CENTURE_SECURITY_VIOLATION_ERROR,
        message: "Message blocked by Centure security scan",
        data: {
          categories: scanResult.categories,
          reason: "Unsafe content detected",
        },
      },
    };
  }

  /**
   * Extracts content from a JSONRPC message for scanning
   * Returns arrays of text and image content to scan separately
   */
  private extractContentForScanning(message: JSONRPCMessage): {
    texts: string[];
    images: string[];
  } {
    const texts: string[] = [];
    const images: string[] = [];

    // Check if this is a request or response with content to scan
    if ("result" in message && message.result) {
      const result = message.result as any;

      if (result.content && Array.isArray(result.content)) {
        // MCP content array format
        for (const item of result.content) {
          if (item.type === "text" && item.text) {
            texts.push(item.text);
          } else if (item.type === "image" && item.data) {
            images.push(item.data);
          } else if (
            item.type === "resource" &&
            item.resource?.blob &&
            isImageMimeType(item.resource.mimeType)
          ) {
            images.push(item.resource.blob);
          }
        }
      } else if (result.content && typeof result.content === "string") {
        // Plain string content
        texts.push(result.content);
      } else {
        // Fallback: stringify the entire result as text
        texts.push(JSON.stringify(result));
      }
    } else if ("params" in message && message.params) {
      // For requests, scan the params as text
      texts.push(JSON.stringify(message.params));
    }

    return { texts, images };
  }

  async start(): Promise<void> {
    // Wire up callbacks from the wrapped transport to our callbacks
    this.wrappedTransport.onclose = () => {
      this.onclose?.();
    };

    this.wrappedTransport.onerror = (error: Error) => {
      this.onerror?.(error);
    };

    this.wrappedTransport.onmessage = async (
      message: JSONRPCMessage,
      extra?: MessageExtraInfo,
    ) => {
      try {
        // Step 1: Check if we should scan this message
        let shouldScan = true;
        if (this.shouldScanMessageHook) {
          shouldScan = await this.shouldScanMessageHook({
            message,
            extra,
          });
        }

        // If we're not scanning, pass through immediately
        if (!shouldScan) {
          this.onmessage?.(message, extra);
          return;
        }

        // Step 2: Extract content and perform the scan
        const { texts, images } = this.extractContentForScanning(message);

        // If there's no content to scan, pass through
        if (texts.length === 0 && images.length === 0) {
          this.onmessage?.(message, extra);
          return;
        }

        // Scan all text and image content
        const scanPromises: Promise<ScanResponse>[] = [];

        for (const text of texts) {
          scanPromises.push(this.client.scanText(text));
        }

        for (const image of images) {
          scanPromises.push(this.client.scanImage(image));
        }

        const scanResults = await Promise.all(scanPromises);

        // Combine scan results - message is unsafe if ANY scan is unsafe
        const isUnsafe = scanResults.some((result) => !result.is_safe);
        const allCategories = scanResults.flatMap(
          (result) => result.categories,
        );

        // Create a combined scan result for hooks
        const combinedScanResult: ScanResponse = {
          is_safe: !isUnsafe,
          categories: allCategories,
          request_id: scanResults[0]?.request_id || "",
          api_key_id: scanResults[0]?.api_key_id || "",
          request_units: scanResults.reduce(
            (sum, result) => sum + result.request_units,
            0,
          ),
          service_tier: scanResults[0]?.service_tier || "standard",
        };

        // Step 3: Call onAfterScan hook if provided
        if (this.onAfterScanHook) {
          const afterScanResult = await this.onAfterScanHook({
            message,
            extra,
            scanResult: combinedScanResult,
          });

          // If the hook says to pass through, do so without further checks
          if (afterScanResult.passthrough) {
            this.onmessage?.(message, extra);
            return;
          }
        }

        // Step 4: Handle unsafe messages
        if (!combinedScanResult.is_safe) {
          let messageToForward: JSONRPCMessage | null = null;

          // Call onUnsafeMessage hook if provided
          if (this.onUnsafeMessageHook) {
            const unsafeResult = await this.onUnsafeMessageHook({
              message,
              extra,
              scanResult: combinedScanResult,
            });

            if (unsafeResult.passthrough) {
              // User chose to allow the message through
              messageToForward = unsafeResult.replace ?? message;
            } else if (unsafeResult.replace) {
              // User provided a replacement message
              messageToForward = unsafeResult.replace;
            } else {
              // passthrough is false and no replacement provided
              // Send JSONRPC error to inform client of blocked attack
              if ("id" in message && message.id !== undefined) {
                messageToForward = this.createErrorResponse(
                  message.id,
                  "method" in message ? message.method : undefined,
                  combinedScanResult,
                );
              }
              // If it's a notification or response, just drop it (no error response needed)
            }
          } else {
            // No hook provided, default behavior: block and send error
            if ("id" in message && message.id !== undefined) {
              messageToForward = this.createErrorResponse(
                message.id,
                "method" in message ? message.method : undefined,
                combinedScanResult,
              );
            }
            // If it's a notification or response, just drop it (no error response needed)
          }

          // Forward the message if we have one
          if (messageToForward) {
            this.onmessage?.(messageToForward, extra);
          }
        } else {
          // Message is safe, forward as-is
          this.onmessage?.(message, extra);
        }
      } catch (error) {
        if (error instanceof Error) {
          // If scanning fails, report error but pass through the message
          this.onerror?.(error);
        }

        throw error;
      }
    };

    // Forward setProtocolVersion if it exists
    if (this.wrappedTransport.setProtocolVersion) {
      const originalSetProtocolVersion =
        this.wrappedTransport.setProtocolVersion.bind(this.wrappedTransport);
      this.setProtocolVersion = (version: string) => {
        originalSetProtocolVersion(version);
      };
    }

    // Delegate to wrapped transport's start
    await this.wrappedTransport.start();

    // Copy sessionId if available
    if (this.wrappedTransport.sessionId) {
      this.sessionId = this.wrappedTransport.sessionId;
    }
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    // Forward messages from client to server without scanning
    await this.wrappedTransport.send(message, options);
  }

  async close(): Promise<void> {
    await this.wrappedTransport.close();
  }
}
