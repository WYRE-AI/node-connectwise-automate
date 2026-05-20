/**
 * Configuration types and defaults for the ConnectWise Automate client
 */

import { ConnectWiseAutomateValidationError } from './errors.js';

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Whether rate limiting is enabled (default: true) */
  enabled: boolean;
  /** Maximum requests per window (default: 100) */
  maxRequests: number;
  /** Window duration in milliseconds (default: 60000 = 1 minute) */
  windowMs: number;
  /** Threshold percentage to start throttling (default: 0.8 = 80%) */
  throttleThreshold: number;
  /** Delay between retries on 429 (default: 5000ms) */
  retryAfterMs: number;
  /** Maximum retry attempts on rate limit errors (default: 3) */
  maxRetries: number;
}

/**
 * Default rate limit configuration for ConnectWise Automate
 * Conservative defaults - adjust based on your specific rate limits
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: true,
  maxRequests: 100,
  windowMs: 60_000, // 1 minute
  throttleThreshold: 0.8, // 80% = 80 requests
  retryAfterMs: 5_000,
  maxRetries: 3,
};

/**
 * Authentication method
 */
export type AuthMethod = 'integrator' | 'user';

/**
 * Integrator credentials configuration
 */
export interface IntegratorCredentials {
  /** Authentication method */
  method: 'integrator';
  /** Integrator username */
  integratorUsername: string;
  /** Integrator password */
  integratorPassword: string;
}

/**
 * User credentials configuration
 */
export interface UserCredentials {
  /** Authentication method */
  method: 'user';
  /** Username */
  username: string;
  /** Password */
  password: string;
  /** Two-factor authentication code (if enabled) */
  twoFactorCode?: string;
}

/**
 * Configuration for the ConnectWise Automate client
 */
export interface ConnectWiseAutomateConfig {
  /** ConnectWise Automate server URL (e.g., https://your-server.hostedrmm.com) */
  serverUrl: string;
  /** Client ID (provided by ConnectWise) */
  clientId: string;
  /** Authentication credentials */
  credentials: IntegratorCredentials | UserCredentials;
  /** Rate limiting configuration */
  rateLimit?: Partial<RateLimitConfig>;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedConfig {
  serverUrl: string;
  clientId: string;
  credentials: IntegratorCredentials | UserCredentials;
  rateLimit: RateLimitConfig;
}

/**
 * Resolves a configuration object by applying defaults
 */
export function resolveConfig(config: ConnectWiseAutomateConfig): ResolvedConfig {
  // Validate server URL
  if (!config.serverUrl) {
    throw new Error('serverUrl is required');
  }

  // Remove trailing slash if present
  const serverUrl = config.serverUrl.replace(/\/$/, '');

  // Enforce HTTPS for the server URL. An explicit http:// localhost / 127.0.0.1
  // exception is allowed for local development and testing only.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(serverUrl);
  } catch {
    throw new ConnectWiseAutomateValidationError(
      `serverUrl must be a valid URL (received: "${config.serverUrl}")`
    );
  }

  const isLocalhost =
    parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';

  if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && isLocalhost)) {
    throw new ConnectWiseAutomateValidationError(
      `serverUrl must use HTTPS (received scheme: "${parsedUrl.protocol}"). ` +
        'Plain http:// is only permitted for localhost/127.0.0.1.'
    );
  }

  // Validate client ID
  if (!config.clientId) {
    throw new Error('clientId is required');
  }

  // Validate credentials
  if (!config.credentials) {
    throw new Error('credentials are required');
  }

  if (config.credentials.method === 'integrator') {
    if (!config.credentials.integratorUsername || !config.credentials.integratorPassword) {
      throw new Error('integratorUsername and integratorPassword are required for integrator authentication');
    }
  } else if (config.credentials.method === 'user') {
    if (!config.credentials.username || !config.credentials.password) {
      throw new Error('username and password are required for user authentication');
    }
  } else {
    throw new Error('Invalid authentication method');
  }

  return {
    serverUrl,
    clientId: config.clientId,
    credentials: config.credentials,
    rateLimit: {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...config.rateLimit,
    },
  };
}
