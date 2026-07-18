/**
 * HttpClient response-handling tests.
 *
 * Regression: connectwise-automate-mcp#54 — every API-backed tool returned an
 * empty object (200 with a non-JSON body was swallowed as `{}`), and repeat
 * calls threw "Body is unusable: Body has already been read" (the error path
 * consumed the body with response.json() and then re-read it with
 * response.text() in the catch). The body must be read exactly once.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../src/http.js';
import { AuthManager } from '../../src/auth.js';
import { RateLimiter } from '../../src/rate-limiter.js';
import {
  ConnectWiseAutomateError,
  ConnectWiseAutomateNotFoundError,
  ConnectWiseAutomateServerError,
} from '../../src/errors.js';
import type { ResolvedConfig } from '../../src/config.js';

const config = {
  serverUrl: 'https://testserver.hostedrmm.com',
  clientId: 'test-client-id',
  credentials: {
    method: 'integrator',
    integratorUsername: 'test-user',
    integratorPassword: 'test-password',
  },
  rateLimit: { maxRequestsPerMinute: 600, maxRetries: 3, retryAfterMs: 1000 },
} as unknown as ResolvedConfig;

function makeClient(): HttpClient {
  const auth = {
    getToken: vi.fn().mockResolvedValue('test-token'),
    refreshToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthManager;
  const limiter = new RateLimiter(config.rateLimit);
  return new HttpClient(config, auth, limiter);
}

/** A real Response so body semantics (one-shot stream) are exercised. */
function realResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('HttpClient response handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a JSON 200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('[{"Id":1}]'));
    const result = await makeClient().request('/Clients');
    expect(result).toEqual([{ Id: 1 }]);
  });

  it('parses JSON even when the content-type header is wrong', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('{"Id":7}', { headers: { 'content-type': 'text/plain' } })
    );
    const result = await makeClient().request('/Clients/7');
    expect(result).toEqual({ Id: 7 });
  });

  it('returns {} for a genuinely empty 200/204 body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('', { status: 200, headers: { 'content-type': 'text/plain' } })
    );
    const result = await makeClient().request('/Commands');
    expect(result).toEqual({});
  });

  it('throws a descriptive error (not {}) for a 200 with a non-JSON body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('<html>WAF challenge page</html>', {
        headers: { 'content-type': 'text/html' },
      })
    );
    await expect(makeClient().request('/Clients')).rejects.toThrow(
      /Expected JSON .* text\/html.*WAF challenge page/
    );
  });

  it('reads a non-JSON error body exactly once — no "Body is unusable"', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('<html>gateway error</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      })
    );
    // Before the fix this threw TypeError "Body is unusable: Body has already
    // been read" instead of the typed not-found error carrying the real body.
    const err = await makeClient()
      .request('/Clients/999')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateNotFoundError);
    expect((err as ConnectWiseAutomateNotFoundError).response).toContain('gateway error');
  });

  it('passes a parsed JSON error body to the typed error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('{"Message":"boom"}', { status: 503 })
    );
    // 5xx retries once, then throws — both responses must be fresh.
    vi.mocked(fetch).mockResolvedValueOnce(realResponse('{"Message":"boom"}', { status: 503 }));
    vi.mocked(fetch).mockResolvedValueOnce(realResponse('{"Message":"boom"}', { status: 503 }));
    const err = await makeClient()
      .request('/Clients')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateServerError);
    expect((err as ConnectWiseAutomateServerError).response).toEqual({ Message: 'boom' });
  }, 15000);

  it('generic non-2xx statuses raise ConnectWiseAutomateError with the raw body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('teapot', { status: 418, headers: { 'content-type': 'text/plain' } })
    );
    const err = await makeClient()
      .request('/Clients')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateError);
    expect((err as ConnectWiseAutomateError).response).toBe('teapot');
  });
});
