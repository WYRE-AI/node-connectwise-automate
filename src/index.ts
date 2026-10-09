/**
 * node-connectwise-automate
 * Comprehensive, fully-typed Node.js/TypeScript library for the ConnectWise Automate API
 */

// Main client
export { ConnectWiseAutomateClient } from './client.js';

// Configuration
export type {
  ConnectWiseAutomateConfig,
  RateLimitConfig,
  IntegratorCredentials,
  UserCredentials,
  AuthMethod,
} from './config.js';
export { DEFAULT_RATE_LIMIT_CONFIG } from './config.js';

// Error classes
export {
  ConnectWiseAutomateError,
  ConnectWiseAutomateAuthenticationError,
  ConnectWiseAutomateForbiddenError,
  ConnectWiseAutomateNotFoundError,
  ConnectWiseAutomateValidationError,
  ConnectWiseAutomateRateLimitError,
  ConnectWiseAutomateServerError,
  ConnectWiseAutomateAmbiguousRequestError,
} from './errors.js';

export { isTransientNetworkError } from './network-errors.js';

// Types
export * from './types/index.js';
