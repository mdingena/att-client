import type { ClientConfiguration } from '../ClientConfiguration/ClientConfiguration.js';
import type { Log } from '../Log/Log.js';
import { MAX_WORKER_CONCURRENCY_WARNING } from '../constants.js';

class ClientConfigurationError extends Error {}

export function validateClientConfiguration(config: ClientConfiguration, log: Log): void {
  /* Validate client credentials. */
  const { credentials } = config;
  if ('clientId' in credentials || 'clientSecret' in credentials || 'scope' in credentials) {
    if (
      typeof credentials.clientId === 'undefined' ||
      typeof credentials.clientSecret === 'undefined' ||
      typeof credentials.scope === 'undefined'
    ) {
      log.error("Cannot create bot client without 'clientId', 'clientSecret', and 'scope'.");
      throw new ClientConfigurationError('Invalid client configuration.');
    }
  } else if ('username' in credentials || 'password' in credentials) {
    if (typeof credentials.username === 'undefined' || typeof credentials.password === 'undefined') {
      log.error("Cannot create user client without 'username' and 'password'.");
      throw new ClientConfigurationError('Invalid client configuration.');
    }
  } else {
    log.error('Cannot create client without either bot credentials or user credentials.');
    throw new ClientConfigurationError('Invalid client configuration.');
  }

  /* Validate included / excluded groups configuration. */
  if (
    typeof config.excludedGroups !== 'undefined' &&
    config.excludedGroups.length > 0 &&
    typeof config.includedGroups !== 'undefined' &&
    config.includedGroups.length > 0
  ) {
    log.warn('Client configuration contains both included and excluded groups. Ignoring excluded groups.');
  }

  /* Validate worker configuration. */
  if (
    typeof config.maxWorkerConcurrency !== 'undefined' &&
    config.maxWorkerConcurrency > MAX_WORKER_CONCURRENCY_WARNING
  ) {
    log.warn(
      'Maximum concurrency is set above recommended level. Client may experience issues with WebSocket migrations as a result of too many concurrent requests.'
    );
  }
}
