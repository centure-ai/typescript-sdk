import { ApiErrorResponse, HttpStatus } from "./types";

/**
 * Base error class for Centure API errors
 */
export class CentureApiError extends Error {
  /**
   * HTTP status code
   */
  public readonly statusCode: number;

  /**
   * Original error response from the API
   */
  public readonly response?: ApiErrorResponse;

  /**
   * Request ID if available
   */
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    response?: ApiErrorResponse,
    requestId?: string,
  ) {
    super(message);
    this.name = "CentureApiError";
    this.statusCode = statusCode;
    this.response = response;
    this.requestId = requestId;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CentureApiError);
    }
  }
}

/**
 * Error thrown when the request is invalid (400)
 */
export class BadRequestError extends CentureApiError {
  constructor(
    message: string,
    response?: ApiErrorResponse,
    requestId?: string,
  ) {
    super(message, HttpStatus.BAD_REQUEST, response, requestId);
    this.name = "BadRequestError";
  }
}

/**
 * Error thrown when authentication fails (401)
 */
export class UnauthorizedError extends CentureApiError {
  constructor(
    message: string,
    response?: ApiErrorResponse,
    requestId?: string,
  ) {
    super(message, HttpStatus.UNAUTHORIZED, response, requestId);
    this.name = "UnauthorizedError";
  }
}

/**
 * Error thrown when the payload is too large (413)
 */
export class PayloadTooLargeError extends CentureApiError {
  constructor(
    message: string,
    response?: ApiErrorResponse,
    requestId?: string,
  ) {
    super(message, HttpStatus.PAYLOAD_TOO_LARGE, response, requestId);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Error thrown when the server encounters an error (500)
 */
export class InternalServerError extends CentureApiError {
  constructor(
    message: string,
    response?: ApiErrorResponse,
    requestId?: string,
  ) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, response, requestId);
    this.name = "InternalServerError";
  }
}

/**
 * Error thrown when the API key is missing
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "API key is required. Provide it via the constructor or set the CENTURE_API_KEY environment variable.",
    );
    this.name = "MissingApiKeyError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MissingApiKeyError);
    }
  }
}

/**
 * Error thrown when both only and exclude are specified in scan options
 */
export class ScanOptionsError extends Error {
  constructor() {
    super("Cannot specify both only and exclude");
    this.name = "ScanOptionsError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScanOptionsError);
    }
  }
}
