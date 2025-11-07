/**
 * Threat category codes returned by the Centure API
 */
export enum ThreatCategory {
  BEHAVIORAL_OVERRIDE_LOW = "behavioral_override_low",
  ROLE_MANIPULATION = "role_manipulation",
  CONTEXT_INJECTION = "context_injection",
  INSTRUCTION_HIERARCHY_MANIPULATION = "instruction_hierarchy_manipulation",
  OUTPUT_MANIPULATION = "output_manipulation",
  DATA_EXFILTRATION = "data_exfiltration",
  EXTERNAL_ACTIONS = "external_actions",
  SAFETY_BYPASS = "safety_bypass",
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
}

/**
 * Request body for image scanning (base64)
 */
export interface ScanImageRequest {
  /**
   * Base64-encoded image (PNG, JPEG, GIF, WebP)
   */
  image: string;
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
