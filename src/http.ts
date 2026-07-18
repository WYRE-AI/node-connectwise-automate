/**
 * HTTP layer for the ConnectWise Automate API
 */

import type { ResolvedConfig } from './config.js';
import type { AuthManager } from './auth.js';
import type { RateLimiter } from './rate-limiter.js';
import {
  ConnectWiseAutomateError,
  ConnectWiseAutomateAuthenticationError,
  ConnectWiseAutomateForbiddenError,
  ConnectWiseAutomateNotFoundError,
  ConnectWiseAutomateValidationError,
  ConnectWiseAutomateRateLimitError,
  ConnectWiseAutomateServerError,
} from './errors.js';

/**
 * HTTP request options
 */
export interface RequestOptions {
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** URL query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Skip authentication (for token endpoint) */
  skipAuth?: boolean;
}

/**
 * HTTP client for making authenticated requests to the ConnectWise Automate API
 */
export class HttpClient {
  private readonly config: ResolvedConfig;
  private readonly authManager: AuthManager;
  private readonly rateLimiter: RateLimiter;

  constructor(config: ResolvedConfig, authManager: AuthManager, rateLimiter: RateLimiter) {
    this.config = config;
    this.authManager = authManager;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Make an authenticated request to the API
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params, skipAuth = false } = options;

    // Build the URL
    let url = `${this.config.serverUrl}/cwa/api/v1${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return this.executeRequest<T>(url, method, body, skipAuth);
  }

  /**
   * Make a request to a full URL (for pagination)
   */
  async requestUrl<T>(url: string): Promise<T> {
    return this.executeRequest<T>(url, 'GET', undefined, false);
  }

  /**
   * Execute the request with retry logic
   */
  private async executeRequest<T>(
    url: string,
    method: string,
    body: unknown,
    skipAuth: boolean,
    retryCount: number = 0,
    isRetryAfter401: boolean = false
  ): Promise<T> {
    // Wait for a rate limit slot
    await this.rateLimiter.waitForSlot();

    // Get the auth token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'ClientId': this.config.clientId,
    };

    if (!skipAuth) {
      const token = await this.authManager.getToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Record the request
    this.rateLimiter.recordRequest();

    // Make the request
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle the response
    return this.handleResponse<T>(response, url, method, body, skipAuth, retryCount, isRetryAfter401);
  }

  /**
   * Handle the response and errors
   */
  private async handleResponse<T>(
    response: Response,
    url: string,
    method: string,
    body: unknown,
    skipAuth: boolean,
    retryCount: number,
    isRetryAfter401: boolean
  ): Promise<T> {
    // Read the body EXACTLY once, as text, for every path. A fetch Response
    // body is a one-shot stream: response.json() followed by response.text()
    // in a catch throws "Body is unusable: Body has already been read",
    // which masked the real (often non-JSON, e.g. WAF/proxy HTML) response
    // on hosted Automate instances (connectwise-automate-mcp#54).
    const rawBody = await response.text();
    let parsedBody: unknown;
    let bodyIsJson = false;
    try {
      parsedBody = JSON.parse(rawBody);
      bodyIsJson = true;
    } catch {
      parsedBody = rawBody;
    }

    if (response.ok) {
      if (bodyIsJson) {
        return parsedBody as T;
      }
      if (rawBody.trim() === '') {
        // Genuinely empty 200/204 — preserve the historical empty-object shape.
        return {} as T;
      }
      // A 200 whose body isn't JSON is not a success we can use (login pages,
      // WAF challenges, proxy errors). Surfacing it beats returning {} and
      // letting the caller believe the API answered.
      throw new ConnectWiseAutomateError(
        `Expected JSON from ${method} ${url} but got ${
          response.headers.get('content-type') ?? 'no content-type'
        }: ${rawBody.slice(0, 200)}`,
        response.status,
        rawBody.slice(0, 2000)
      );
    }

    const responseBody: unknown = parsedBody;

    switch (response.status) {
      case 400:
        // Could be bad credentials on token request or validation error
        if (this.isValidationError(responseBody)) {
          const errors = this.parseValidationErrors(responseBody);
          throw new ConnectWiseAutomateValidationError('Validation error', errors, responseBody);
        }
        throw new ConnectWiseAutomateAuthenticationError(
          'Bad request - invalid credentials or parameters',
          400,
          responseBody
        );

      case 401:
        // If this is already a retry after 401, don't retry again
        if (isRetryAfter401) {
          throw new ConnectWiseAutomateAuthenticationError(
            'Authentication failed after token refresh',
            401,
            responseBody
          );
        }
        // Try to refresh the token and retry once
        await this.authManager.refreshToken();
        return this.executeRequest<T>(url, method, body, skipAuth, retryCount, true);

      case 403:
        throw new ConnectWiseAutomateForbiddenError('Access forbidden - insufficient permissions', responseBody);

      case 404:
        throw new ConnectWiseAutomateNotFoundError('Resource not found', responseBody);

      case 429:
        // Rate limited - retry with backoff
        if (this.rateLimiter.shouldRetry(retryCount)) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const delay = this.rateLimiter.parseRetryAfter(retryAfterHeader);
          this.rateLimiter.handleRateLimitError(retryCount);
          await this.sleep(delay);
          return this.executeRequest<T>(url, method, body, skipAuth, retryCount + 1, isRetryAfter401);
        }
        throw new ConnectWiseAutomateRateLimitError(
          'Rate limit exceeded and max retries reached',
          this.config.rateLimit.retryAfterMs,
          responseBody
        );

      default:
        if (response.status >= 500) {
          // Server error - retry once
          if (retryCount === 0) {
            await this.sleep(1000);
            return this.executeRequest<T>(url, method, body, skipAuth, 1, isRetryAfter401);
          }
          throw new ConnectWiseAutomateServerError(
            `Server error: ${response.status} ${response.statusText}`,
            response.status,
            responseBody
          );
        }
        throw new ConnectWiseAutomateError(
          `Request failed: ${response.status} ${response.statusText}`,
          response.status,
          responseBody
        );
    }
  }

  /**
   * Check if a response body indicates a validation error
   */
  private isValidationError(responseBody: unknown): boolean {
    if (typeof responseBody === 'object' && responseBody !== null) {
      const body = responseBody as Record<string, unknown>;
      // ConnectWise Automate validation errors
      return Array.isArray(body['Errors']) || Array.isArray(body['errors']) ||
             typeof body['ModelState'] === 'object';
    }
    return false;
  }

  /**
   * Parse validation errors from response body
   */
  private parseValidationErrors(responseBody: unknown): Array<{ field: string; message: string }> {
    if (typeof responseBody === 'object' && responseBody !== null) {
      const body = responseBody as Record<string, unknown>;

      // Handle ModelState format (common in .NET APIs)
      if (typeof body['ModelState'] === 'object' && body['ModelState'] !== null) {
        const modelState = body['ModelState'] as Record<string, string[]>;
        const errors: Array<{ field: string; message: string }> = [];
        for (const [field, messages] of Object.entries(modelState)) {
          if (Array.isArray(messages)) {
            for (const message of messages) {
              errors.push({ field, message: String(message) });
            }
          }
        }
        return errors;
      }

      // Handle Errors array format
      const errorArray = (body['Errors'] ?? body['errors']) as unknown;
      if (Array.isArray(errorArray)) {
        return errorArray.map((err: unknown) => {
          if (typeof err === 'object' && err !== null) {
            const e = err as Record<string, unknown>;
            return {
              field: String(e['field'] ?? e['Field'] ?? e['property'] ?? 'unknown'),
              message: String(e['message'] ?? e['Message'] ?? e['error'] ?? 'Unknown error'),
            };
          }
          return { field: 'unknown', message: String(err) };
        });
      }
    }
    return [];
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
