/**
 * HTTP layer for the ConnectWise Automate API
 *
 * Requests go to `https://<host>/cwa/api/<version><path>` — the prefix that
 * connectwise-rest, pyconnectwise and AutomateAPI.ps1 all use. Almost every
 * route lives under v1; a few (Contacts, some Scripts routes) exist only
 * under v2.
 */

import { Agent, type Dispatcher } from 'undici';
import type { ResolvedConfig } from './config.js';
import type { AuthManager } from './auth.js';
import type { RateLimiter } from './rate-limiter.js';
import { isTransientNetworkError } from './network-errors.js';
import {
  ConnectWiseAutomateError,
  ConnectWiseAutomateAmbiguousRequestError,
  ConnectWiseAutomateAuthenticationError,
  ConnectWiseAutomateForbiddenError,
  ConnectWiseAutomateNotFoundError,
  ConnectWiseAutomateValidationError,
  ConnectWiseAutomateRateLimitError,
  ConnectWiseAutomateServerError,
} from './errors.js';

/** API version path segment */
export type ApiVersion = 'v1' | 'v2';

/** HTTP methods used by the API */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * HTTP request options
 */
export interface RequestOptions {
  /** HTTP method */
  method?: HttpMethod;
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** URL query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** API version segment (default: 'v1') */
  apiVersion?: ApiVersion;
  /** Skip authentication (for token endpoint) */
  skipAuth?: boolean;
}

/**
 * Methods whose requests can safely be re-sent after a 5xx or a dropped
 * connection (RFC 9110 §9.2.2). POST and PATCH are never retried: a script
 * launch or command that did reach the server would otherwise run twice.
 */
const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set(['GET', 'PUT', 'DELETE']);

/**
 * Total attempts for an idempotent call, including the first. Two retries
 * cover a stale keep-alive socket without stretching a command poll's deadline
 * across an unbounded reconnect loop.
 */
const MAX_IDEMPOTENT_ATTEMPTS = 3;

/** Base pause before re-sending an idempotent request. Doubles each retry. */
const SERVER_ERROR_RETRY_DELAY_MS = 1000;

/**
 * Shared dispatcher for API calls.
 *
 * Command and script polls wait 3s between GETs. Undici's default
 * `keepAliveTimeout` is 4s, so the next poll reuses a socket the peer (or a
 * WAF in front of hosted Automate) has often already closed, and the read
 * dies with `TypeError: terminated`. Closing idle sockets after 1s forces a
 * fresh connection. `keepAliveMaxTimeout` is the same value so a server
 * `Keep-Alive` hint cannot stretch the idle timeout back out. Pipelining
 * stays at 1 (one request at a time per connection) and `connections` caps
 * the per-origin pool.
 */
export const API_DISPATCHER_OPTIONS = {
  keepAliveTimeout: 1_000,
  keepAliveMaxTimeout: 1_000,
  connections: 10,
  pipelining: 1,
} as const;

export const apiDispatcher: Dispatcher = new Agent(API_DISPATCHER_OPTIONS);

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
    const { method = 'GET', body, params, apiVersion = 'v1', skipAuth = false } = options;
    const url = this.buildUrl(path, apiVersion, params);
    return this.executeRequest<T>(url, method, body, skipAuth);
  }

  /**
   * Make a request to a full URL (for pagination)
   */
  async requestUrl<T>(url: string): Promise<T> {
    return this.executeRequest<T>(url, 'GET', undefined, false);
  }

  /**
   * Build the absolute URL for a resource path
   */
  private buildUrl(
    path: string,
    apiVersion: ApiVersion,
    params: RequestOptions['params']
  ): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${this.config.serverUrl}/cwa/api/${apiVersion}${normalizedPath}`;

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

    return url;
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

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'ClientId': this.config.clientId,
    };

    if (!skipAuth) {
      const token = await this.authManager.getToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Record the request
    this.rateLimiter.recordRequest();

    try {
      // `dispatcher` is undici's extension to RequestInit. Reading the body
      // here, not in handleResponse, is deliberate: a socket that closes
      // mid-body rejects `response.text()` with TypeError('terminated'), and
      // that rejection has to land in this catch to be retried.
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        dispatcher: apiDispatcher,
      } as RequestInit);
      const rawBody = await response.text();
      return await this.handleResponse<T>(
        response,
        rawBody,
        url,
        method,
        body,
        skipAuth,
        retryCount,
        isRetryAfter401
      );
    } catch (error) {
      if (isTransientNetworkError(error) && this.canRetry(method, retryCount)) {
        await this.sleep(this.retryDelayMs(retryCount));
        return this.executeRequest<T>(url, method, body, skipAuth, retryCount + 1, isRetryAfter401);
      }
      // The server may already have queued the command. Retrying would run it
      // twice, so say so and stop. The original socket error stays on `cause`
      // for isTransientNetworkError.
      if (isTransientNetworkError(error) && !IDEMPOTENT_METHODS.has(method)) {
        throw ambiguousRequestError(method, url, body, error);
      }
      throw error;
    }
  }

  /**
   * Handle the response and errors
   */
  private async handleResponse<T>(
    response: Response,
    rawBody: string,
    url: string,
    method: string,
    body: unknown,
    skipAuth: boolean,
    retryCount: number,
    isRetryAfter401: boolean
  ): Promise<T> {
    // The body was read exactly once, as text, by executeRequest. A fetch
    // Response body is a one-shot stream: response.json() followed by
    // response.text() in a catch throws "Body is unusable: Body has already
    // been read", which masked the real (often non-JSON, e.g. WAF/proxy HTML)
    // response on hosted Automate instances (connectwise-automate-mcp#54).
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

    const serverMessage = this.extractServerMessage(parsedBody);
    const describe = (summary: string): string =>
      serverMessage ? `${summary}: ${serverMessage}` : summary;

    switch (response.status) {
      case 400:
        // Malformed request: bad `condition`, unbindable body, model errors.
        // (Bad credentials never reach here — the token endpoint is handled
        // by AuthManager.)
        throw new ConnectWiseAutomateValidationError(
          describe('Bad request'),
          this.parseValidationErrors(parsedBody),
          parsedBody
        );

      case 401:
        // If this is already a retry after 401, don't retry again
        if (isRetryAfter401) {
          throw new ConnectWiseAutomateAuthenticationError(
            describe('Authentication failed after token refresh'),
            401,
            parsedBody
          );
        }
        // Try to refresh the token and retry once
        await this.authManager.refreshToken();
        return this.executeRequest<T>(url, method, body, skipAuth, retryCount, true);

      case 403:
        throw new ConnectWiseAutomateForbiddenError(
          describe('Access forbidden - insufficient permissions'),
          parsedBody
        );

      case 404:
        throw new ConnectWiseAutomateNotFoundError(describe('Resource not found'), parsedBody);

      case 429:
        // Rate limited: the request was not processed, so any method is safe to retry.
        if (this.rateLimiter.shouldRetry(retryCount)) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const delay = this.rateLimiter.parseRetryAfter(retryAfterHeader);
          this.rateLimiter.handleRateLimitError(retryCount);
          await this.sleep(delay);
          return this.executeRequest<T>(url, method, body, skipAuth, retryCount + 1, isRetryAfter401);
        }
        throw new ConnectWiseAutomateRateLimitError(
          describe('Rate limit exceeded and max retries reached'),
          this.config.rateLimit.retryAfterMs,
          parsedBody
        );

      default:
        if (response.status >= 500) {
          if (this.canRetry(method, retryCount)) {
            await this.sleep(this.retryDelayMs(retryCount));
            return this.executeRequest<T>(url, method, body, skipAuth, retryCount + 1, isRetryAfter401);
          }
          throw new ConnectWiseAutomateServerError(
            describe(`Server error: ${response.status} ${response.statusText}`),
            response.status,
            parsedBody
          );
        }
        throw new ConnectWiseAutomateError(
          describe(`Request failed: ${response.status} ${response.statusText}`),
          response.status,
          parsedBody
        );
    }
  }

  /**
   * Whether a failed idempotent request may be re-sent. `retryCount` is how
   * many retries have already happened, so the first call (0) and the second
   * (1) may continue and the third attempt is the last.
   */
  private canRetry(method: string, retryCount: number): boolean {
    return IDEMPOTENT_METHODS.has(method) && retryCount < MAX_IDEMPOTENT_ATTEMPTS - 1;
  }

  /** Exponential backoff: 1s, then 2s. */
  private retryDelayMs(retryCount: number): number {
    return SERVER_ERROR_RETRY_DELAY_MS * 2 ** retryCount;
  }

  /**
   * Pull the human-readable message out of an ASP.NET style error body
   * (`{ "Message": "..." }`), if there is one.
   */
  private extractServerMessage(responseBody: unknown): string | undefined {
    if (typeof responseBody !== 'object' || responseBody === null) {
      return undefined;
    }
    const body = responseBody as Record<string, unknown>;
    const message = body['Message'] ?? body['message'];
    return typeof message === 'string' && message.trim() !== '' ? message : undefined;
  }

  /**
   * Parse field-level validation errors from a response body
   * (ASP.NET `ModelState`, or an `Errors` array). Empty when there are none.
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

const QUEUED_ROUTES = /\/CommandExecute|\/ScriptExecute|\/ScheduledScripts/i;

/**
 * Ids already known from the request body. The execution id (`Id`) is the one
 * a caller can poll; the others only explain which target the lost POST was for.
 */
function describeKnownIds(body: unknown): { id?: number | string; detail: string } {
  if (typeof body !== 'object' || body === null) {
    return { detail: '' };
  }
  const record = body as Record<string, unknown>;
  const parts: string[] = [];
  let executionId: number | string | undefined;

  const id = record['Id'];
  if (typeof id === 'number' || typeof id === 'string') {
    executionId = id;
    parts.push(`id ${id}`);
  }

  const computerId = record['ComputerId'];
  if (typeof computerId === 'number' || typeof computerId === 'string') {
    parts.push(`computer id ${computerId}`);
  }

  const scriptId = record['ScriptId'];
  if (typeof scriptId === 'number' || typeof scriptId === 'string') {
    parts.push(`script id ${scriptId}`);
  }

  const command = record['Command'];
  if (typeof command === 'object' && command !== null) {
    const commandId = (command as Record<string, unknown>)['Id'];
    if (typeof commandId === 'number' || typeof commandId === 'string') {
      parts.push(`command id ${commandId}`);
    }
  }

  const entityIds = record['EntityIds'];
  if (Array.isArray(entityIds) && entityIds.length > 0) {
    const shown = entityIds.slice(0, 10).map((value) => String(value)).join(', ');
    const extra = entityIds.length > 10 ? ', …' : '';
    parts.push(`entity ids ${shown}${extra}`);
  }

  return {
    ...(executionId !== undefined ? { id: executionId } : {}),
    detail: parts.length > 0 ? ` (${parts.join(', ')})` : '',
  };
}

function ambiguousRequestError(
  method: string,
  url: string,
  body: unknown,
  cause: unknown
): ConnectWiseAutomateAmbiguousRequestError {
  const known = describeKnownIds(body);
  const outcome = QUEUED_ROUTES.test(url)
    ? 'The command may or may not have been queued'
    : 'The request may or may not have been processed';
  const message =
    `Connection interrupted during ${method} ${url}. ` +
    `${outcome}${known.detail}. ` +
    'The request was not retried because a retry can run it twice.';
  return new ConnectWiseAutomateAmbiguousRequestError(message, {
    cause,
    ...(known.id !== undefined ? { id: known.id } : {}),
  });
}
