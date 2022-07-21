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
  method: 'POST';
  endpoint: Endpoint.AcceptGroupInvite;
  body: GroupMemberInfo;
};

type GroupInfoResponse = {
  method: 'GET';
  endpoint: Endpoint.GroupInfo;
  body: GroupInfo;
};

type GroupInvitesResponse = {
  method: 'GET';
  endpoint: Endpoint.GroupInvites;
  body: InvitedGroupInfo[];
};

type GroupMemberResponse = {
  method: 'GET';
  endpoint: Endpoint.GroupMember;
  body: GroupMemberInfo;
};

type JoinedGroupsResponse = {
  method: 'GET';
  endpoint: Endpoint.JoinedGroups;
  body: JoinedGroupInfo[];
};

type ServerInfoResponse = {
  method: 'GET';
  endpoint: Endpoint.ServerInfo;
  body: ServerInfo;
};

type ServerConnectionDetailsResponse = {
  method: 'POST';
  endpoint: Endpoint.ServerConsole;
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

type ApiResponseBody<TMethod, TEndpoint> = Extract<ApiResponseUnion, { method: TMethod; endpoint: TEndpoint }>['body'];

export type ApiResponse<TMethod, TEndpoint> = Omit<Response, 'json'> & {
  json: () => Promise<ApiResponseBody<TMethod, TEndpoint>>;
};
