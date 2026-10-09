/**
 * Command and script polls must survive a dropped status read.
 * The launch POST is not retried: a second POST can run the command twice.
 */

import { describe, it, expect, vi } from 'vitest';
import { ComputersResource } from '../../src/resources/computers.js';
import { ScriptsResource } from '../../src/resources/scripts.js';
import { HttpClient } from '../../src/http.js';
import { AuthManager } from '../../src/auth.js';
import { RateLimiter } from '../../src/rate-limiter.js';
import { ConnectWiseAutomateAmbiguousRequestError } from '../../src/errors.js';
import type { ResolvedConfig } from '../../src/config.js';
import type { HttpClient as HttpClientType } from '../../src/http.js';

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

function httpWith(request: ReturnType<typeof vi.fn>): HttpClientType {
  return { request } as unknown as HttpClientType;
}

describe('executeCommandAndWait poll recovery', () => {
  it('keeps polling after transient status-read failures and keeps the execution id', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ Id: 4711, Status: 'Pending', ComputerId: 1 })
      .mockRejectedValueOnce(new TypeError('terminated'))
      .mockRejectedValueOnce(
        Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
      )
      .mockResolvedValueOnce([{ Id: 4711, Status: 'Success', Output: 'ok' }]);
    const computers = new ComputersResource(httpWith(request));

    const result = await computers.executeCommandAndWait(
      1,
      { Command: { Id: '2' } },
      { pollIntervalMs: 1, timeoutMs: 5_000 }
    );

    expect(result.completed).toBe(true);
    expect(result.execution.Id).toBe(4711);
    expect(result.output).toBe('ok');
    expect(result.pollErrors).toBe(2);
    expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('returns completed:false with the execution id when polls fail until the timeout', async () => {
    const socketError = new TypeError('fetch failed', {
      cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_CLOSED' }),
    });
    let calls = 0;
    const request = vi.fn().mockImplementation(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ Id: 99, Status: 'Pending' });
      return Promise.reject(socketError);
    });
    const computers = new ComputersResource(httpWith(request));

    const result = await computers.executeCommandAndWait(
      1,
      { Command: { Id: '2' } },
      { pollIntervalMs: 1, timeoutMs: 40 }
    );

    expect(result.completed).toBe(false);
    expect(result.execution.Id).toBe(99);
    expect(result.status).toBe('Pending');
    expect(result.pollErrors).toBeGreaterThan(0);
    expect(result.waitedMs).toBeGreaterThanOrEqual(40);
  });

  it('does not swallow a non-network poll error', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ Id: 4711, Status: 'Pending' })
      .mockRejectedValueOnce(new Error('Access forbidden'));
    const computers = new ComputersResource(httpWith(request));

    await expect(
      computers.executeCommandAndWait(1, { Command: { Id: '2' } }, { pollIntervalMs: 1, timeoutMs: 5_000 })
    ).rejects.toThrow('Access forbidden');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry the launch POST when the socket drops', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('terminated')));
    const auth = {
      getToken: vi.fn().mockResolvedValue('test-token'),
      refreshToken: vi.fn(),
    } as unknown as AuthManager;
    const computers = new ComputersResource(
      new HttpClient(config, auth, new RateLimiter(config.rateLimit))
    );

    try {
      const err = await computers
        .executeCommandAndWait(7, { Command: { Id: '2' }, Parameters: ['ipconfig'] }, { pollIntervalMs: 1, timeoutMs: 5_000 })
        .catch((error: unknown) => error);

      expect(err).toBeInstanceOf(ConnectWiseAutomateAmbiguousRequestError);
      expect((err as Error).message).toMatch(/may or may not have been queued/);
      expect((err as Error).message).toMatch(/computer id 7/);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(String((vi.mocked(fetch).mock.calls[0] as [string])[0])).toContain('/CommandExecute');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('runAndWait poll recovery', () => {
  it('keeps polling history after a transient read and still reports the run', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ ContainsUnsuccessfulResults: false, ScriptResults: [] })
      .mockRejectedValueOnce(new TypeError('terminated'))
      .mockResolvedValueOnce([
        { Id: 9, ScriptId: 3, Status: 'Completed', State: 'Success', DiagnosticMessage: 'done' },
      ]);
    const scripts = new ScriptsResource(httpWith(request));

    const [result] = await scripts.runAndWait(
      [4],
      { ScriptId: 3 },
      { pollIntervalMs: 1, timeoutMs: 5_000 }
    );

    expect(result?.completed).toBe(true);
    expect(result?.computerId).toBe(4);
    expect(result?.state).toBe('Success');
    expect(result?.pollErrors).toBe(1);
  });

  it('returns completed:false for a target whose history polls fail until the timeout', async () => {
    let calls = 0;
    const request = vi.fn().mockImplementation(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve([]);
      if (calls === 2) return Promise.resolve({ ContainsUnsuccessfulResults: false });
      return Promise.reject(new TypeError('terminated'));
    });
    const scripts = new ScriptsResource(httpWith(request));

    const [result] = await scripts.runAndWait(
      [4],
      { ScriptId: 3 },
      { pollIntervalMs: 1, timeoutMs: 40 }
    );

    expect(result?.launched).toBe(true);
    expect(result?.completed).toBe(false);
    expect(result?.computerId).toBe(4);
    expect(result?.pollErrors).toBeGreaterThan(0);
    expect(result?.waitedMs).toBeGreaterThanOrEqual(40);
  });

  it('does not retry the script-execute POST when the socket drops', async () => {
    // History baselines are GETs (one per target) and may be retried. The launch POST must not be.
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        return Promise.resolve(
          new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        );
      }
      return Promise.reject(new TypeError('terminated'));
    });
    vi.stubGlobal('fetch', fetchMock);
    const auth = {
      getToken: vi.fn().mockResolvedValue('test-token'),
      refreshToken: vi.fn(),
    } as unknown as AuthManager;
    const scripts = new ScriptsResource(
      new HttpClient(config, auth, new RateLimiter(config.rateLimit))
    );

    try {
      const err = await scripts
        .runAndWait([4, 5], { ScriptId: 3 }, { pollIntervalMs: 1, timeoutMs: 5_000 })
        .catch((error: unknown) => error);

      expect(err).toBeInstanceOf(ConnectWiseAutomateAmbiguousRequestError);
      expect((err as Error).message).toMatch(/may or may not have been queued/);
      expect((err as Error).message).toMatch(/script id 3/);
      expect((err as Error).message).toMatch(/entity ids 4, 5/);
      const methods = fetchMock.mock.calls.map((call) => (call[1] as RequestInit | undefined)?.method ?? 'GET');
      expect(methods.filter((method) => method === 'POST')).toEqual(['POST']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
