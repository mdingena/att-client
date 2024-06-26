import type { GroupInfo, GroupMemberInfo, ServerInfo } from '../Api/schemas/index.js';
import type { ClientEvent } from './ClientEvent.js';

type EventMessage<T extends ClientEvent> = {
  id: 0;
  event: T;
  key: string;
  responseCode: number;
};

type GroupMemberUpdateMessage = EventMessage<'group-member-update'> & {
  content: GroupMemberInfo;
};

type GroupServerHeartbeatMessage = EventMessage<'group-server-heartbeat'> & {
  content: ServerInfo;
};

type GroupServerStatusMessage = EventMessage<'group-server-status'> & {
  content: ServerInfo;
};

type GroupUpdateMessage = EventMessage<'group-update'> & {
  content: GroupInfo;
};

type MeGroupDeleteMessage = EventMessage<'me-group-delete'> & {
  content: {
    group: GroupInfo;
    member: GroupMemberInfo;
  };
};

type MeGroupInviteCreateMessage = EventMessage<'me-group-invite-create'> & {
  content: GroupInfo;
};

type MeGroupInviteDeleteMessage = EventMessage<'me-group-invite-delete'> & {
  content: GroupInfo;
};

type MeGroupCreateMessage = EventMessage<'me-group-create'> & {
  content: {
    group: GroupInfo;
    member: GroupMemberInfo;
  };
};

type ClientEventMessageUnion =
  | GroupMemberUpdateMessage
  | GroupServerHeartbeatMessage
  | GroupServerStatusMessage
  | GroupUpdateMessage
  | MeGroupCreateMessage
  | MeGroupDeleteMessage
  | MeGroupInviteCreateMessage
  | MeGroupInviteDeleteMessage;

export type ClientEventMessage<T> = Extract<ClientEventMessageUnion, { event: T }>;
