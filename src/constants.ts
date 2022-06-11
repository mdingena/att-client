import type { Config } from './Client/Config';
import { Verbosity } from './Logger';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const REST_BASE_URL = 'https://967phuchye.execute-api.ap-southeast-2.amazonaws.com/prod/api';

const SERVER_HEARTBEAT_TIMEOUT = 10 * MINUTE;

const TOKEN_URL = 'https://accounts.townshiptale.com/connect/token';

const WEBSOCKET_MIGRATION_HANDOVER_PERIOD = 10 * SECOND;

const WEBSOCKET_MIGRATION_INTERVAL = 110 * MINUTE;

const WEBSOCKET_MIGRATION_RETRY_DELAY = 10 * SECOND;

const WEBSOCKET_PING_INTERVAL = 5 * MINUTE;

const WEBSOCKET_URL = 'wss://5wx2mgoj95.execute-api.ap-southeast-2.amazonaws.com/dev';

const X_API_KEY = '2l6aQGoNes8EHb94qMhqQ5m2iaiOM9666oDTPORf';

export const DEFAULTS: Required<Omit<Config, 'clientId' | 'clientSecret' | 'scope'>> = {
  console: console,
  excludedGroups: [],
  includedGroups: [],
  logVerbosity: Verbosity.Warning,
  restBaseUrl: REST_BASE_URL,
  serverHeartbeatTimeout: SERVER_HEARTBEAT_TIMEOUT,
  tokenUrl: TOKEN_URL,
  webSocketMigrationHandoverPeriod: WEBSOCKET_MIGRATION_HANDOVER_PERIOD,
  webSocketMigrationInterval: WEBSOCKET_MIGRATION_INTERVAL,
  webSocketMigrationRetryDelay: WEBSOCKET_MIGRATION_RETRY_DELAY,
  webSocketPingInterval: WEBSOCKET_PING_INTERVAL,
  webSocketUrl: WEBSOCKET_URL,
  xApiKey: X_API_KEY
};
