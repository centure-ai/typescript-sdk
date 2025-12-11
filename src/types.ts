/**
 * Threat category codes returned by the Centure API
 *
 * - output_manipulation: Controls AI output content, formatting, or style
 * - context_injection: Fake context, roles, system messages, or instruction overrides
 * - data_exfiltration: Attempts to extract sensitive data
 * - unauthorized_actions: Attempts to trigger unauthorized actions or API calls
 */
export enum ThreatCategory {
  OUTPUT_MANIPULATION = "output_manipulation",
  CONTEXT_INJECTION = "context_injection",
  DATA_EXFILTRATION = "data_exfiltration",
  UNAUTHORIZED_ACTIONS = "unauthorized_actions",
}

/**
 * Risk category type for filtering scan results
 *
 * - output_manipulation: Controls AI output content, formatting, or style
 * - context_injection: Fake context, roles, system messages, or instruction overrides
 * - data_exfiltration: Attempts to extract sensitive data
 * - unauthorized_actions: Attempts to trigger unauthorized actions or API calls
 */
export type RiskCategory =
  | "output_manipulation"
  | "context_injection"
  | "data_exfiltration"
  | "unauthorized_actions";

/**
 * Options for scan requests
 */
export interface ScanOptions {
  /**
   * Only return detections for these categories.
   * Cannot be used together with exclude.
   */
  only?: RiskCategory[];

  /**
   * Exclude detections for these categories.
   * Cannot be used together with only.
   */
  exclude?: RiskCategory[];

  /**
   * Minimum confidence level for detections
   */
  minimum_confidence?: "medium" | "high";
}

/**
 * Confidence level of a threat detection
 */
export enum ConfidenceLevel {
  MEDIUM = "medium",
  HIGH = "high",
}

/**
 * Service tier for the API request
 */
export enum ServiceTier {
  LOW = "low",
  STANDARD = "standard",
  DEDICATED = "dedicated",
}

/**
 * Category detected in a scan result
 */
export interface DetectedCategory {
  /**
   * The threat category code
   */
  code: ThreatCategory;

  /**
   * Confidence level of the detection
   */
  confidence: ConfidenceLevel;
}

/**
 * Response from a prompt injection scan
 */
export interface ScanResponse {
  /**
   * Whether the content is safe (no prompt injection detected)
   */
  is_safe: boolean;

  /**
   * List of detected threat categories
   */
  categories: DetectedCategory[];

  /**
   * Explanation when content is flagged
   */
  reason?: string;

  /**
   * Unique identifier for this request
   */
  request_id: string;

  /**
   * ID of the API key used for the request
   */
  api_key_id: string;

  /**
   * Number of request units consumed
   */
  request_units: number;

  /**
   * Number of request units billed
   */
  billed_request_units: number;

  /**
   * Service tier used for the request
   */
  service_tier: ServiceTier;
}

/**
 * Request body for text scanning
 */
export interface ScanTextRequest {
  /**
   * Text content to scan for prompt injection
   */
  content: string;

  /**
   * Only return detections for these categories
   */
  only?: RiskCategory[];

  /**
   * Exclude detections for these categories
   */
  exclude?: RiskCategory[];

  /**
   * Minimum confidence level for detections
   */
  minimum_confidence?: "medium" | "high";
}

/**
 * Request body for image scanning (base64)
 */
export interface ScanImageRequest {
  /**
   * Base64-encoded image (PNG, JPEG, GIF, WebP)
   */
  image: string;

  /**
   * Only return detections for these categories
   */
  only?: RiskCategory[];

  /**
   * Exclude detections for these categories
   */
  exclude?: RiskCategory[];

  /**
   * Minimum confidence level for detections
   */
  minimum_confidence?: "medium" | "high";
}

/**
 * Error response from the API
 */
export interface ApiErrorResponse {
  /**
   * Error message
   */
  error?: string;

  /**
   * Detailed error message
   */
  message?: string;

  /**
   * Additional error details
   */
  detail?: string;
}

/**
 * HTTP status codes that can be returned by the API
 */
export enum HttpStatus {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  PAYLOAD_TOO_LARGE = 413,
  INTERNAL_SERVER_ERROR = 500,
}
