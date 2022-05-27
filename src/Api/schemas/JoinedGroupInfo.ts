import type { GroupInfo } from './GroupInfo';
import type { GroupMemberInfo } from './GroupMemberInfo';
import type { GroupRoleInfo } from './GroupRoleInfo';
import type { GroupServerInfo } from './GroupServerInfo';

export type JoinedGroupInfo = {
  group: GroupInfo & {
    servers?: GroupServerInfo[];
    allowed_servers_count: number;
    roles?: GroupRoleInfo[];
  };
  member: GroupMemberInfo;
};
