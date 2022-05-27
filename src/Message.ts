import type { GroupInfo, GroupMemberInfo } from './Api/schemas';
import type { Subscription } from './Subscriptions';

type CommonMessage = {
  id: number;
  key: string;
  responseCode: number;
};

type GroupInvitationRequestedMessage = CommonMessage & {
  event: Subscription.GroupInvitationRequested;
  content: GroupInfo;
};

type GroupInvitationRevokedMessage = CommonMessage & {
  event: Subscription.GroupInvitationRevoked;
  content: GroupInfo;
};

type JoinedGroupMessage = CommonMessage & {
  event: Subscription.JoinedGroup;
  content: GroupInfo;
};

type LeftGroupMessage = CommonMessage & {
  event: Subscription.LeftGroup;
  content: {
    group: GroupInfo;
    member: GroupMemberInfo;
  };
};

type MessageUnion =
  | GroupInvitationRequestedMessage
  | GroupInvitationRevokedMessage
  | JoinedGroupMessage
  | LeftGroupMessage;

export type Message<T> = Extract<MessageUnion, { event: T }>;
