import type { Endpoint } from './Endpoint';
import type {
  GroupInfo,
  GroupMemberInfo,
  InvitedGroupInfo,
  JoinedGroupInfo,
  ServerConnectionInfo,
  ServerInfo
} from './schemas';

type AcceptGroupInviteResponse = {
  endpoint: `POST ${Endpoint.AcceptGroupInvite}`;
  body: GroupMemberInfo;
};

type GroupInfoResponse = {
  endpoint: `GET ${Endpoint.GroupInfo}`;
  body: GroupInfo;
};

type GroupInvitesResponse = {
  endpoint: `GET ${Endpoint.GroupInvites}`;
  body: InvitedGroupInfo[];
};

type GroupMemberResponse = {
  endpoint: `GET ${Endpoint.GroupMember}`;
  body: GroupMemberInfo;
};

type JoinedGroupsResponse = {
  endpoint: `GET ${Endpoint.JoinedGroups}`;
  body: JoinedGroupInfo[];
};

type ServerInfoResponse = {
  endpoint: `GET ${Endpoint.ServerInfo}`;
  body: ServerInfo;
};

type ServerConnectionDetailsResponse = {
  endpoint: `POST ${Endpoint.ServerConsole}`;
  body: ServerConnectionInfo;
};

type ApiResponseUnion =
  | AcceptGroupInviteResponse
  | GroupInfoResponse
  | GroupInvitesResponse
  | GroupMemberResponse
  | JoinedGroupsResponse
  | ServerConnectionDetailsResponse
  | ServerInfoResponse;

export type ApiResponse<T> = Extract<ApiResponseUnion, { endpoint: T }>;
