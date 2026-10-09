/**
 * Socket failures from Node's fetch (undici).
 *
 * A dropped keep-alive connection has no HTTP status. Undici reports it as
 * `TypeError: terminated` (the body stream closed early) or
 * `TypeError: fetch failed` with a `cause` such as `UND_ERR_SOCKET` /
 * "other side closed". Callers — including command polls and the MCP server —
 * match the whole chain, not only the outer TypeError.
 */

import { ConnectWiseAutomateError } from './errors.js';

const TRANSIENT_CODES: ReadonlySet<string> = new Set([
  'ECONNRESET',
  'UND_ERR_SOCKET',
  'UND_ERR_CLOSED',
  'EPIPE',
  'ETIMEDOUT',
]);

function messageIsTransient(message: string): boolean {
  const lower = message.toLowerCase();
  if (
    /\bterminated\b/.test(lower) ||
    lower.includes('fetch failed') ||
    lower.includes('other side closed')
  ) {
    return true;
  }
  return (
    lower.includes('econnreset') ||
    lower.includes('und_err_socket') ||
    lower.includes('und_err_closed') ||
    lower.includes('epipe') ||
    lower.includes('etimedout')
  );
}

function hasTransientSignal(error: unknown, seen: Set<unknown>): boolean {
  if (typeof error === 'string') {
    return messageIsTransient(error);
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if (seen.has(error)) {
    return false;
  }
  seen.add(error);

  const record = error as { code?: unknown; message?: unknown; cause?: unknown };
  if (typeof record.code === 'string' && TRANSIENT_CODES.has(record.code.toUpperCase())) {
    return true;
  }

  // Typed HTTP errors describe a response we already received. A server
  // message that happens to say "terminated" is not a socket drop; only an
  // attached cause can be.
  if (!(error instanceof ConnectWiseAutomateError)) {
    if (typeof record.message === 'string' && messageIsTransient(record.message)) {
      return true;
    }
  }

  if ('cause' in record) {
    return hasTransientSignal(record.cause, seen);
  }
  return false;
}

/**
 * Whether `error` (or its `cause` chain) is a dropped socket rather than an
 * HTTP response the caller should treat as final.
 */
export function isTransientNetworkError(error: unknown): boolean {
  return hasTransientSignal(error, new Set());
}
