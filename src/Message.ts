import type { Subscription } from './Subscriptions';

type Role = {
  role_id: number;
  name: string;
  permissions: string[];
  allowed_commands: string[];
};

type Server = {
  id: number;
  name: string;
  scene_index: number;
  status: string;
};

type Member = {
  group_id: number;
  user_id: number;
  username: string;
  bot: boolean;
  icon: number;
  permissions: string;
  role_id: number;
  created_at: string;
  type: string;
};

type Group = {
  id: number;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
  type: string;
  tags: string[];
  roles?: Role[];
  allowed_servers_count?: number;
  servers?: Server[];
};

type CommonMessage = {
  id: number;
  key: string;
  responseCode: number;
};

type GroupInvitationRequestedMessage = CommonMessage & {
  event: Subscription.GroupInvitationRequested;
  content: Group;
};

type GroupInvitationRevokedMessage = CommonMessage & {
  event: Subscription.GroupInvitationRevoked;
  content: Group;
};

type JoinedGroupMessage = CommonMessage & {
  event: Subscription.JoinedGroup;
  content: Group;
};

type LeftGroupMessage = CommonMessage & {
  event: Subscription.LeftGroup;
  content: {
    group: Group;
    member: Member;
  };
};

type MessageUnion =
  | GroupInvitationRequestedMessage
  | GroupInvitationRevokedMessage
  | JoinedGroupMessage
  | LeftGroupMessage;

export type Message<T> = Extract<MessageUnion, { event: T }>;
