import {
  BadRequestError,
  CentureApiError,
  InternalServerError,
  MissingApiKeyError,
  PayloadTooLargeError,
  UnauthorizedError,
} from "./errors";
import {
  ApiErrorResponse,
  HttpStatus,
  ScanImageRequest,
  ScanResponse,
  ScanTextRequest,
} from "./types";

/**
 * Options for configuring the Centure client
 */
export interface CentureOptions {
  /**
   * Base URL for the API
   * @default "https://api.centure.ai"
   */
  baseUrl?: string;

  /**
   * API key for authentication
   * @default process.env.CENTURE_API_KEY
   */
  apiKey?: string;

  /**
   * Custom fetch implementation
   * Useful for Node.js environments or custom configurations
   */
  fetch?: typeof fetch;

  /**
   * Additional options to pass to fetch requests
   */
  fetchOptions?: RequestInit;
}

/**
 * Client for interacting with the Centure API
 */
export class CentureClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly fetchOptions: RequestInit;

  /**
   * Creates a new Centure API client
   * @param options - Configuration options
   * @throws {MissingApiKeyError} If no API key is provided
   */
  constructor(options?: CentureOptions) {
    this.baseUrl = options?.baseUrl || "https://api.centure.ai";

    // Get API key from options or environment variable
    const apiKey = options?.apiKey || process.env.CENTURE_API_KEY;
    if (!apiKey) {
      throw new MissingApiKeyError();
    }
    this.apiKey = apiKey;

    // Use custom fetch or global fetch
    this.fetchFn = options?.fetch || fetch;
    this.fetchOptions = options?.fetchOptions || {};
  }

  /**
   * Makes an API request with proper error handling
   */
  private async request<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      Authorization: `Bearer ${this.apiKey}`,
      ...this.fetchOptions.headers,
      ...init?.headers,
    };

    const response = await this.fetchFn(url, {
      ...this.fetchOptions,
      ...init,
      headers,
    });

    // Handle successful response
    if (response.ok) {
      return response.json() as Promise<T>;
    }

    // Handle error responses
    let errorBody: ApiErrorResponse | undefined;
    try {
      errorBody = await response.json();
    } catch {
      // If we can't parse the error body, continue with undefined
    }

    const errorMessage =
      errorBody?.error ||
      errorBody?.message ||
      errorBody?.detail ||
      response.statusText;

    // Throw appropriate error based on status code
    switch (response.status) {
      case HttpStatus.BAD_REQUEST:
        throw new BadRequestError(errorMessage, errorBody);
      case HttpStatus.UNAUTHORIZED:
        throw new UnauthorizedError(errorMessage, errorBody);
      case HttpStatus.PAYLOAD_TOO_LARGE:
        throw new PayloadTooLargeError(errorMessage, errorBody);
      case HttpStatus.INTERNAL_SERVER_ERROR:
        throw new InternalServerError(errorMessage, errorBody);
      default:
        throw new CentureApiError(errorMessage, response.status, errorBody);
    }
  }

  /**
   * Scans text content for prompt injection attacks
   * @param content - The text content to scan
   * @returns Scan results with safety assessment and detected categories
   */
  async scanText(content: string): Promise<ScanResponse> {
    const body: ScanTextRequest = { content };

    return this.request<ScanResponse>("/v1/prompt-injection/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Scans an image for prompt injection attacks
   * @param image - Base64-encoded image string OR Buffer (will be converted to base64)
   * @returns Scan results with safety assessment and detected categories
   */
  async scanImage(image: string | Buffer): Promise<ScanResponse> {
    let base64Image: string;

    // Convert Buffer to base64 if needed
    if (Buffer.isBuffer(image)) {
      base64Image = image.toString("base64");
    } else {
      base64Image = image;
    }

    const body: ScanImageRequest = { image: base64Image };

    return this.request<ScanResponse>("/v1/prompt-injection/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }
}
