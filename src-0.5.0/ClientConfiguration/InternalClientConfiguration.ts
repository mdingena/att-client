import type { ClientConfiguration } from './ClientConfiguration.js';
import { DEFAULTS } from '../constants.js';

export type InternalClientConfiguration = Required<Omit<ClientConfiguration, 'console' | 'logVerbosity'>>;

export function getInternalClientConfiguration(config: ClientConfiguration): InternalClientConfiguration {
  return {
    credentials: config.credentials,
    excludedGroups:
      config.excludedGroups && (typeof config.includedGroups === 'undefined' || config.includedGroups.length === 0)
        ? config.excludedGroups
        : DEFAULTS.excludedGroups,
    includedGroups: config.includedGroups ?? DEFAULTS.includedGroups,
    maxWorkerConcurrency: config.maxWorkerConcurrency ?? DEFAULTS.maxWorkerConcurrency,
    restBaseUrl: config.restBaseUrl ?? DEFAULTS.restBaseUrl,
    serverConnectionRecoveryDelay: config.serverConnectionRecoveryDelay ?? DEFAULTS.serverConnectionRecoveryDelay,
    serverHeartbeatTimeout: config.serverHeartbeatTimeout ?? DEFAULTS.serverHeartbeatTimeout,
    supportedServerFleets: config.supportedServerFleets ?? DEFAULTS.supportedServerFleets,
    tokenUrl: config.tokenUrl ?? DEFAULTS.tokenUrl,
    webSocketMigrationHandoverPeriod:
      config.webSocketMigrationHandoverPeriod ?? DEFAULTS.webSocketMigrationHandoverPeriod,
    webSocketMigrationInterval: config.webSocketMigrationInterval ?? DEFAULTS.webSocketMigrationInterval,
    webSocketMigrationRetryDelay: config.webSocketMigrationRetryDelay ?? DEFAULTS.webSocketMigrationRetryDelay,
    webSocketPingInterval: config.webSocketPingInterval ?? DEFAULTS.webSocketPingInterval,
    webSocketRecoveryRetryDelay: config.webSocketRecoveryRetryDelay ?? DEFAULTS.webSocketRecoveryRetryDelay,
    webSocketRecoveryTimeout: config.webSocketRecoveryTimeout ?? DEFAULTS.webSocketRecoveryTimeout,
    webSocketRequestAttempts: config.webSocketRequestAttempts ?? DEFAULTS.webSocketRequestAttempts,
    webSocketRequestRetryDelay: config.webSocketRequestRetryDelay ?? DEFAULTS.webSocketRequestRetryDelay,
    webSocketUrl: config.webSocketUrl ?? DEFAULTS.webSocketUrl,
    xApiKey: config.xApiKey ?? DEFAULTS.xApiKey
  };
}
