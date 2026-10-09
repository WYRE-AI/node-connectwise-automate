/**
 * Custom error classes for the ConnectWise Automate client
 */

/**
 * Base error class for all ConnectWise Automate errors
 */
export class ConnectWiseAutomateError extends Error {
  /** HTTP status code if applicable */
  readonly statusCode: number;
  /** Raw response data if available */
  readonly response: unknown;

  constructor(message: string, statusCode: number = 0, response?: unknown) {
    super(message);
    this.name = 'ConnectWiseAutomateError';
    this.statusCode = statusCode;
    this.response = response;
    Object.setPrototypeOf(this, ConnectWiseAutomateError.prototype);
  }
}

/**
 * Authentication error (401 unauthorized, a rejected token request, or a
 * token response that requires a two-factor passcode)
 */
export class ConnectWiseAutomateAuthenticationError extends ConnectWiseAutomateError {
  constructor(message: string, statusCode: number = 401, response?: unknown) {
    super(message, statusCode, response);
    this.name = 'ConnectWiseAutomateAuthenticationError';
    Object.setPrototypeOf(this, ConnectWiseAutomateAuthenticationError.prototype);
  }
}

/**
 * Forbidden error (403 permission denied)
 */
export class ConnectWiseAutomateForbiddenError extends ConnectWiseAutomateError {
  constructor(message: string, response?: unknown) {
    super(message, 403, response);
    this.name = 'ConnectWiseAutomateForbiddenError';
    Object.setPrototypeOf(this, ConnectWiseAutomateForbiddenError.prototype);
  }
}

/**
 * Resource not found error (404)
 */
export class ConnectWiseAutomateNotFoundError extends ConnectWiseAutomateError {
  constructor(message: string, response?: unknown) {
    super(message, 404, response);
    this.name = 'ConnectWiseAutomateNotFoundError';
    Object.setPrototypeOf(this, ConnectWiseAutomateNotFoundError.prototype);
  }
}

/**
 * Validation error (400 bad request — a malformed `condition`, an unbindable
 * body, or model errors; `errors` is populated when the body carries
 * ASP.NET `ModelState` or an `Errors` array)
 */
export class ConnectWiseAutomateValidationError extends ConnectWiseAutomateError {
  /** Field-level validation errors */
  readonly errors: Array<{ field: string; message: string }>;

  constructor(message: string, errors: Array<{ field: string; message: string }> = [], response?: unknown) {
    super(message, 400, response);
    this.name = 'ConnectWiseAutomateValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ConnectWiseAutomateValidationError.prototype);
  }
}

/**
 * Rate limit exceeded error (429)
 */
export class ConnectWiseAutomateRateLimitError extends ConnectWiseAutomateError {
  /** Suggested retry delay in milliseconds */
  readonly retryAfter: number;

  constructor(message: string, retryAfter: number = 5000, response?: unknown) {
    super(message, 429, response);
    this.name = 'ConnectWiseAutomateRateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, ConnectWiseAutomateRateLimitError.prototype);
  }
}

/**
 * Server error (500+)
 */
export class ConnectWiseAutomateServerError extends ConnectWiseAutomateError {
  constructor(message: string, statusCode: number = 500, response?: unknown) {
    super(message, statusCode, response);
    this.name = 'ConnectWiseAutomateServerError';
    Object.setPrototypeOf(this, ConnectWiseAutomateServerError.prototype);
  }
}

/**
 * A POST or PATCH failed at the socket, so it is unknown whether the server
 * accepted it. The call is never retried: a command or script launch that did
 * reach Automate would otherwise run twice.
 *
 * `id` is set when the request already carried an execution id. Computer,
 * script, and command ids that were known are named in the message instead,
 * so a missing `id` means the execution id was not known — not that the
 * target was unknown.
 */
export class ConnectWiseAutomateAmbiguousRequestError extends ConnectWiseAutomateError {
  /** Execution id, when the request already included one. */
  readonly id?: number | string;

  constructor(message: string, options?: { cause?: unknown; id?: number | string }) {
    super(message, 0);
    this.name = 'ConnectWiseAutomateAmbiguousRequestError';
    if (options?.id !== undefined) {
      this.id = options.id;
    }
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, ConnectWiseAutomateAmbiguousRequestError.prototype);
  }
}
