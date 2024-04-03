import type { ServerFleet } from '../Api/index.js';
import type { Verbosity } from '../Logger/index.js';

export type Scope =
  | 'group.info'
  | 'group.invite'
  | 'group.join'
  | 'group.leave'
  | 'group.members'
  | 'group.view'
  | 'server.console'
  | 'server.view'
  | 'ws.group'
  | 'ws.group_bans'
  | 'ws.group_invites'
  | 'ws.group_members'
  | 'ws.group_servers';

interface CommonConfig {
  console?: Pick<Console, 'error' | 'warn' | 'info' | 'debug'>;
  excludedGroups?: number[];
  includedGroups?: number[];
  logPrefix?: string;
  logVerbosity?: Verbosity;
  maxMissedServerHeartbeats?: number;
  maxSubscriptionsPerWebSocket?: number;
  maxWorkerConcurrency?: number;
  restBaseUrl?: string;
  serverConnectionRecoveryDelay?: number;
  serverHeartbeatInterval?: number;
  supportedServerFleets?: ServerFleet[];
  tokenUrl?: string;
  webSocketMigrationHandoverPeriod?: number;
  webSocketMigrationInterval?: number;
  webSocketMigrationRetryDelay?: number;
  webSocketPingInterval?: number;
  webSocketRecoveryRetryDelay?: number;
  webSocketRecoveryTimeout?: number;
  webSocketRequestAttempts?: number;
  webSocketRequestRetryDelay?: number;
  webSocketUrl?: string;
  xApiKey?: string;
}

interface BotConfig extends CommonConfig {
  clientId: string;
  clientSecret: string;
  scope: Scope[];
}

interface UserConfig extends CommonConfig {
  username: string;
  password: string;
}

export type Config = BotConfig | UserConfig;
