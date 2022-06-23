import type { ServerFleet } from '../Api';
import type { Verbosity } from '../Logger';

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

export interface Config {
  clientId: string;
  clientSecret: string;
  console?: Pick<Console, 'error' | 'warn' | 'info' | 'debug'>;
  excludedGroups?: number[];
  includedGroups?: number[];
  logVerbosity?: Verbosity;
  maxWorkerConcurrency?: number;
  restBaseUrl?: string;
  scope: Scope[];
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
