import type { ServerFleet } from '../Client/ServerFleet.js';
import type { LogVerbosity } from '../Log/LogVerbosity.js';

type Scope =
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

export type BotCredentials = {
  clientId: string;
  clientSecret: string;
  scope: Scope[];
};

export type UserCredentials = {
  username: string;
  password: string;
};

export interface ClientConfiguration {
  console?: Pick<Console, 'error' | 'warn' | 'info' | 'debug'>;
  credentials: BotCredentials | UserCredentials;
  excludedGroups?: number[];
  includedGroups?: number[];
  logVerbosity?: LogVerbosity;
  maxWorkerConcurrency?: number;
  restBaseUrl?: string;
  serverConnectionRecoveryDelay?: number;
  serverHeartbeatTimeout?: number;
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
