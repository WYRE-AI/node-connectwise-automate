import { describe, it, expect } from 'vitest';
import { ConnectWiseAutomateServerError, ConnectWiseAutomateAmbiguousRequestError } from '../../src/errors.js';
import { isTransientNetworkError } from '../../src/network-errors.js';

describe('isTransientNetworkError', () => {
  it('matches undici closing the body early', () => {
    expect(isTransientNetworkError(new TypeError('terminated'))).toBe(true);
  });

  it('matches fetch failed and a socket cause', () => {
    const error = new TypeError('fetch failed', {
      cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }),
    });
    expect(isTransientNetworkError(error)).toBe(true);
    expect(isTransientNetworkError(error.cause)).toBe(true);
  });

  it.each([
    'ECONNRESET',
    'UND_ERR_SOCKET',
    'UND_ERR_CLOSED',
    'EPIPE',
    'ETIMEDOUT',
  ])('matches code %s on the error or its cause', (code) => {
    expect(isTransientNetworkError(Object.assign(new Error('reset'), { code }))).toBe(true);
    const wrapped = new TypeError('fetch failed', {
      cause: Object.assign(new Error('other side closed'), { code }),
    });
    expect(isTransientNetworkError(wrapped)).toBe(true);
  });

  it('matches the phrases on a nested cause only', () => {
    const error = new Error('request failed', {
      cause: new Error('other side closed'),
    });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it('does not treat an HTTP error as a socket drop', () => {
    const httpError = new ConnectWiseAutomateServerError('Server error: terminated', 503);
    expect(isTransientNetworkError(httpError)).toBe(false);
  });

  it('still matches a typed error whose cause is a socket drop', () => {
    const wrapped = new ConnectWiseAutomateAmbiguousRequestError(
      'The command may or may not have been queued',
      { cause: new TypeError('terminated'), id: 4711 }
    );
    expect(isTransientNetworkError(wrapped)).toBe(true);
    expect(wrapped.id).toBe(4711);
  });

  it('rejects unrelated failures', () => {
    expect(isTransientNetworkError(new Error('Access forbidden'))).toBe(false);
    expect(isTransientNetworkError(new TypeError('Invalid URL'))).toBe(false);
    expect(isTransientNetworkError('not a socket error')).toBe(false);
    expect(isTransientNetworkError(undefined)).toBe(false);
    expect(isTransientNetworkError(null)).toBe(false);
  });
});
