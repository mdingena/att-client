import type { Config } from './Config';
import { Verbosity } from './Logger';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const DEFAULTS: Required<Pick<Config, 'console' | 'excludedGroups' | 'includedGroups' | 'logVerbosity'>> = {
  console: console,
  excludedGroups: [],
  includedGroups: [],
  logVerbosity: Verbosity.Warning
};

export const REST_BASE_URL = 'https://967phuchye.execute-api.ap-southeast-2.amazonaws.com/prod/api';

export const SERVER_HEARTBEAT_TIMEOUT = 10 * MINUTE;

export const TOKEN_URL = 'https://accounts.townshiptale.com/connect/token';

export const WEBSOCKET_MIGRATION_INTERVAL = 110 * MINUTE;

export const WEBSOCKET_PING_INTERVAL = 5 * MINUTE;

export const WEBSOCKET_URL = 'wss://5wx2mgoj95.execute-api.ap-southeast-2.amazonaws.com/dev';

export const X_API_KEY = '2l6aQGoNes8EHb94qMhqQ5m2iaiOM9666oDTPORf';
