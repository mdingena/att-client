import type { Endpoint } from './Endpoint';
import type { GroupMemberInfo, InvitedGroupInfo, JoinedGroupInfo } from './schemas';

type AcceptGroupInviteResponse = {
  endpoint: `POST ${Endpoint.AcceptGroupInvite}`;
  body: GroupMemberInfo;
};

type GroupInvitesResponse = {
  endpoint: `GET ${Endpoint.GroupInvites}`;
  body: InvitedGroupInfo[];
};

type JoinedGroupsResponse = {
  endpoint: `GET ${Endpoint.JoinedGroups}`;
  body: JoinedGroupInfo[];
};

type ResponseUnion = AcceptGroupInviteResponse | GroupInvitesResponse | JoinedGroupsResponse;

export type ApiResponse<T> = Extract<ResponseUnion, { endpoint: T }>;
