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
  scope: Scope[];
}
