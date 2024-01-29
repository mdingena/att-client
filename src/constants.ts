import type { ServerFleet } from './Api/index.js';
import type { Config } from './Client/Config.js';
import { Verbosity } from './Logger/index.js';

export const AGENT = {
  name: 'att-client',
  version: '0.5.0-beta.1'
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const MAX_WORKER_CONCURRENCY = 5;

const MAX_SUBSCRIPTIONS_PER_WEBSOCKET = 50;

export const MAX_WORKER_CONCURRENCY_WARNING = 10;

const REST_BASE_URL = 'https://webapi.townshiptale.com/api';

const SERVER_CONNECTION_RECOVERY_DELAY = 10 * SECOND;

const SERVER_HEARTBEAT_TIMEOUT = 10 * MINUTE;

const SUPPORTED_SERVER_FLEETS: ServerFleet[] = ['att-release', 'att-quest'];

const TOKEN_URL = 'https://accounts.townshiptale.com/connect/token';

const WEBSOCKET_MIGRATION_HANDOVER_PERIOD = 10 * SECOND;

const WEBSOCKET_MIGRATION_INTERVAL = 110 * MINUTE;

const WEBSOCKET_MIGRATION_RETRY_DELAY = 10 * SECOND;

const WEBSOCKET_PING_INTERVAL = 5 * MINUTE;

const WEBSOCKET_RECOVERY_RETRY_DELAY = 5 * SECOND;

const WEBSOCKET_RECOVERY_TIMEOUT = 2 * MINUTE;

const WEBSOCKET_REQUEST_ATTEMPTS = 3;

const WEBSOCKET_REQUEST_RETRY_DELAY = 3 * SECOND;

const WEBSOCKET_URL = 'wss://websocket.townshiptale.com';

const X_API_KEY = '2l6aQGoNes8EHb94qMhqQ5m2iaiOM9666oDTPORf';

export const DEFAULTS: Required<Omit<Config, 'clientId' | 'clientSecret' | 'scope' | 'username' | 'password'>> = {
  console: console,
  excludedGroups: [],
  includedGroups: [],
  logVerbosity: Verbosity.Warning,
  restBaseUrl: REST_BASE_URL,
  maxWorkerConcurrency: MAX_WORKER_CONCURRENCY,
  maxSubscriptionsPerWebSocket: MAX_SUBSCRIPTIONS_PER_WEBSOCKET,
  serverConnectionRecoveryDelay: SERVER_CONNECTION_RECOVERY_DELAY,
  serverHeartbeatTimeout: SERVER_HEARTBEAT_TIMEOUT,
  supportedServerFleets: SUPPORTED_SERVER_FLEETS,
  tokenUrl: TOKEN_URL,
  webSocketMigrationHandoverPeriod: WEBSOCKET_MIGRATION_HANDOVER_PERIOD,
  webSocketMigrationInterval: WEBSOCKET_MIGRATION_INTERVAL,
  webSocketMigrationRetryDelay: WEBSOCKET_MIGRATION_RETRY_DELAY,
  webSocketPingInterval: WEBSOCKET_PING_INTERVAL,
  webSocketRecoveryRetryDelay: WEBSOCKET_RECOVERY_RETRY_DELAY,
  webSocketRecoveryTimeout: WEBSOCKET_RECOVERY_TIMEOUT,
  webSocketRequestAttempts: WEBSOCKET_REQUEST_ATTEMPTS,
  webSocketRequestRetryDelay: WEBSOCKET_REQUEST_RETRY_DELAY,
  webSocketUrl: WEBSOCKET_URL,
  xApiKey: X_API_KEY
};
